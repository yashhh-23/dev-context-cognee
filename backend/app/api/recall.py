"""Recall API — search, memify, and forget Cognee memory nodes."""
import asyncio
import difflib
from fastapi import APIRouter, Query, HTTPException, Depends
import numpy as np
from typing import Optional
from cognee.infrastructure.databases.vector.embeddings.get_embedding_engine import get_embedding_engine

import hashlib
from app.utils.embedding_utils import (
    get_text_embedding,
    cosine_similarity,
    CONFLICT_MIN_THRESHOLD,
    CONFLICT_MAX_THRESHOLD,
    DIFFLIB_CONFLICT_MIN,
    DIFFLIB_CONFLICT_MAX,
)
from pydantic import BaseModel
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.models.session import PinnedNode, SessionRecord, MemoryFeedback
from app.services.recall_service import search_memory, extract_text
from app.core.security import verify_safe_input
import cognee
from app.utils.embedding_utils import sanitize_dataset_name
import httpx

router = APIRouter()


class MemifyRequest(BaseModel):
    content: str


def parse_item(item, idx: int, pinned_map: dict, feedback_map: dict) -> dict:
    """Extract metadata from a Cognee recall result. Uses pre-fetched pinned_map to avoid N+1 queries."""
    text = extract_text(item)
    if isinstance(item, dict):
        score_val = item.get("score") or item.get("relevance") or 1.0
        item_id = item.get("id") or item.get("node_id") or str(idx)
        source = item.get("source", "cognee")
        session_id = item.get("session_id")
        created_at = item.get("created_at")
    else:
        score_val = getattr(item, "score", None) or getattr(item, "relevance", 1.0) or 1.0
        item_id = str(getattr(item, "id", idx))
        source = getattr(item, "source", "cognee")
        session_id = getattr(item, "session_id", None)
        created_at = getattr(item, "created_at", None)
    # O(1) lookup using pre-fetched map — no per-item DB query
    is_pinned = pinned_map.get(item_id, False)
    thumbs, confidence = feedback_map.get(item_id, ("", 100))
    return {
        "id": item_id,
        "content": text,
        "score": float(score_val),
        "source": source,
        "session_id": session_id,
        "created_at": created_at,
        "conflicts": [],
        "pinned": is_pinned,
        "thumbs": thumbs,
        "confidence_score": confidence,
    }


@router.get("")
async def recall(
    q: str = Query("", description="Natural language query"),
    limit: int = Query(50, ge=1, le=100),
    db: Session = Depends(get_db),
):
    """Recall relevant memory nodes — returns a list with pinned status."""
    verify_safe_input(q, "query")
    try:
        raw = await search_memory(q)
    except Exception as e:
        print(f"[recall] search_memory error: {e}")
        return []
    if not raw:
        return []
    items = raw if isinstance(raw, list) else [raw]
    items_to_process = items[:limit]

    # Bulk-fetch all pinned node records in a single query to avoid N+1
    all_ids = []
    for idx, item in enumerate(items_to_process):
        if isinstance(item, dict):
            item_id = item.get("id") or item.get("node_id") or str(idx)
        else:
            item_id = str(getattr(item, "id", idx))
        all_ids.append(item_id)

    pinned_records = db.query(PinnedNode).filter(PinnedNode.node_id.in_(all_ids)).all()
    pinned_map = {r.node_id: r.pinned for r in pinned_records}

    feedback_records = db.query(MemoryFeedback).filter(MemoryFeedback.node_id.in_(all_ids)).all()
    feedback_map = {f.node_id: (f.thumbs, f.confidence_score) for f in feedback_records}

    # Compute conflicts in-memory across result set (no extra Cognee calls)
    texts = [extract_text(item) for item in items_to_process][:20]
    conflict_map: dict[int, list[str]] = {i: [] for i in range(len(texts))}
    
    # Pre-compute all embeddings once
    embeddings = [await get_text_embedding(t) for t in texts]

    for i in range(len(texts)):
        for j in range(len(texts)):
            if i == j:
                continue
            if not texts[i] or not texts[j]:
                continue
            
            emb1 = embeddings[i]
            emb2 = embeddings[j]
            
            if emb1 is not None and emb2 is not None:
                sim = cosine_similarity(emb1, emb2)
                # Moderate similarity represents a potential semantic overlap/conflict
                if CONFLICT_MIN_THRESHOLD <= sim < CONFLICT_MAX_THRESHOLD:
                    conflict_map[i].append(texts[j][:100])
            else:
                sim = difflib.SequenceMatcher(None, texts[i].strip().lower(), texts[j].strip().lower()).ratio()
                if DIFFLIB_CONFLICT_MIN <= sim < DIFFLIB_CONFLICT_MAX:
                    conflict_map[i].append(texts[j][:100])

    results = []
    for idx, item in enumerate(items_to_process):
        parsed = parse_item(item, idx, pinned_map, feedback_map)
        parsed["conflicts"] = conflict_map.get(idx, [])
        results.append(parsed)

    # Save actual context size for the latest active session
    try:
        latest = db.query(SessionRecord).order_by(SessionRecord.timestamp.desc()).first()
        if latest:
            latest.context_size = len(results)
    except Exception as e:
        print(f"[recall] Failed to save context_size to database: {e}")
    return results


class RecallRequestModel(BaseModel):
    query: str
    languageId: Optional[str] = None
    similarityThreshold: Optional[float] = 0.75

@router.post("")
async def recall_post(body: RecallRequestModel, db: Session = Depends(get_db)):
    results = await recall(q=body.query, limit=50, db=db)
    if not results:
        return {"bugs": [], "message": "No matching memory nodes found."}
    return {"bugs": results}



@router.get("/search")
async def search_memory_api(
    q: str = Query("", description="Natural language query"),
    limit: int = Query(50, ge=1, le=100),
    db: Session = Depends(get_db),
):
    """Retrieve memory search results matching the query."""
    return await recall(q, limit, db)


@router.post("/memify")
async def memify(body: MemifyRequest):
    """Store arbitrary text into Cognee memory graph."""
    verify_safe_input(body.content, "content")
    if not body.content.strip():
        raise HTTPException(status_code=400, detail="content cannot be empty")
    try:
        await cognee.remember(body.content)
        node_id = hashlib.sha256(body.content.encode()).hexdigest()[:24]
        return {"node_id": node_id, "status": "stored"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Cognee remember failed: {str(e)}")


@router.delete("/{node_id}")
async def forget_node(node_id: str, db: Session = Depends(get_db)):
    """Remove a specific memory node from Cognee (blocks pinned nodes)."""
    pinned_record = db.query(PinnedNode).filter(PinnedNode.node_id == node_id).first()
    if pinned_record and pinned_record.pinned:
        raise HTTPException(status_code=400, detail="Cannot forget a pinned memory node. Unpin it first.")
    try:
        await cognee.forget(node_id)
        return {"success": True, "node_id": node_id}
    except Exception as e:
        print(f"[recall] forget error: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to forget node: {str(e)}")


@router.post("/{node_id}/pin")
async def pin_node(node_id: str, db: Session = Depends(get_db)):
    """Pin a memory node to prevent forgetting."""
    record = db.query(PinnedNode).filter(PinnedNode.node_id == node_id).first()
    if not record:
        record = PinnedNode(node_id=node_id, pinned=True)
        db.add(record)
    else:
        record.pinned = True
    db.commit()
    return {"success": True, "node_id": node_id, "pinned": True}


@router.post("/{node_id}/unpin")
async def unpin_node(node_id: str, db: Session = Depends(get_db)):
    """Unpin a memory node."""
    record = db.query(PinnedNode).filter(PinnedNode.node_id == node_id).first()
    if record:
        record.pinned = False
        db.commit()
    return {"success": True, "node_id": node_id, "pinned": False}


class FeedbackRequest(BaseModel):
    sessionId: str
    qaId: str
    score: int

@router.post("/feedback")
async def submit_feedback(body: FeedbackRequest, db: Session = Depends(get_db)):
    session_record = db.query(SessionRecord).filter(SessionRecord.id == body.sessionId).first()
    if not session_record:
        raise HTTPException(status_code=400, detail="Invalid session ID")
    try:
        await cognee.session.add_feedback(
            session_id=body.sessionId,
            qa_id=body.qaId,
            feedback_score=body.score
        )
        if body.score == 1:        
            await cognee.improve(node_name=[body.qaId])
        return {"status": "ok"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to submit feedback: {str(e)}")

class NodeFeedbackRequest(BaseModel):
    thumbs: str
    correction_note: Optional[str] = None

@router.post("/{node_id}/feedback")
async def submit_node_feedback(node_id: str, body: NodeFeedbackRequest, db: Session = Depends(get_db)):
    record = db.query(MemoryFeedback).filter(MemoryFeedback.node_id == node_id).first()
    if not record:
        record = MemoryFeedback(node_id=node_id, thumbs=body.thumbs, correction_note=body.correction_note)
        db.add(record)
    else:
        record.thumbs = body.thumbs
        if body.correction_note:
            record.correction_note = body.correction_note
            
    if body.thumbs == "up":
        record.confidence_score = 100
    else:
        record.confidence_score = 50
        
    db.commit()
    
    try:
        if body.correction_note:
            sanitized_id = sanitize_dataset_name(node_id)
            await cognee.remember(f"Correction for memory node {sanitized_id}: {body.correction_note}")
            await cognee.improve(session_ids=[sanitized_id])
    except Exception as e:
        print(f"[feedback] Cognee improvement warning: {e}")
        
    return {
        "success": True,
        "node_id": node_id,
        "thumbs": record.thumbs,
        "confidence_score": record.confidence_score,
        "correction_note": record.correction_note
    }

class ChatRequest(BaseModel):
    message: str



@router.post("/chat")
async def chat_memory(body: ChatRequest, db: Session = Depends(get_db)):
    verify_safe_input(body.message, "message")
    try:
        # Sanitize query just in case it is used by Cognee internal tokens
        sanitized_query = sanitize_dataset_name(body.message)
        recalled = await cognee.recall(body.message)
    except Exception as e:
        print(f"[chat] recall error: {e}")
        recalled = []
        
    context_str = ""
    sources = []
    if recalled:
        items = recalled if isinstance(recalled, list) else [recalled]
        all_ids = []
        for idx, item in enumerate(items[:5]):
            if isinstance(item, dict):
                item_id = item.get("id") or item.get("node_id") or str(idx)
            else:
                item_id = str(getattr(item, "id", idx))
            all_ids.append(item_id)
            
        feedback_records = db.query(MemoryFeedback).filter(MemoryFeedback.node_id.in_(all_ids)).all()
        feedback_map = {f.node_id: (f.thumbs, f.confidence_score) for f in feedback_records}
        
        pinned_records = db.query(PinnedNode).filter(PinnedNode.node_id.in_(all_ids)).all()
        pinned_map = {r.node_id: r.pinned for r in pinned_records}
        
        for idx, item in enumerate(items[:5]):
            text = extract_text(item)
            if isinstance(item, dict):
                source = item.get("source", "cognee")
                score_val = item.get("score") or item.get("relevance") or 1.0
                item_id = item.get("id") or item.get("node_id") or str(idx)
            else:
                source = getattr(item, "source", "cognee")
                score_val = getattr(item, "score", None) or getattr(item, "relevance", 1.0) or 1.0
                item_id = str(getattr(item, "id", idx))
                
            thumbs, confidence = feedback_map.get(item_id, ("", 100))
            is_pinned = pinned_map.get(item_id, False)
            
            context_str += f"Memory [{idx+1}] (Source: {source}, Confidence: {confidence}%, Pinned: {is_pinned}):\n{text}\n\n"
            sources.append({
                "id": item_id,
                "content": text,
                "score": float(score_val),
                "source": source,
                "pinned": is_pinned,
                "thumbs": thumbs,
                "confidence_score": confidence
            })
            
    prompt = f"""You are a Principal Software Engineer and software architect pair-programming with the user.
Answer the developer's question using the retrieved codebase memory context below.
Always try to explicitly cite the source files or memory nodes (using markdown links [basename](file://...) or just naming them).
Keep your answer professional, direct, and technically sound.

Recalled Context:
{context_str}

Developer Question:
{body.message}

Response:"""
    
    from app.core.config import settings
    from app.utils.llm_utils import ask_gemini, ask_groq
    
    answer = None
    if settings.GEMINI_API_KEY:
        answer = await ask_gemini(prompt, settings.GEMINI_API_KEY)
    if not answer and settings.GROQ_API_KEY:
        answer = await ask_groq(prompt, settings.GROQ_API_KEY)
    if not answer:
        answer = "No LLM service available or configured correctly."
    return {
        "content": answer,
        "sources": sources
    }
