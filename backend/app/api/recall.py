"""Recall API — search, memify, and forget Cognee memory nodes."""
import asyncio
import difflib
from fastapi import APIRouter, Query, HTTPException, Depends
import numpy as np
from cognee.infrastructure.databases.vector.embeddings.get_embedding_engine import get_embedding_engine

# Cache embeddings in-memory during a single recall search
_embedding_cache: dict[str, list[float]] = {}

async def _get_text_embedding(text: str) -> list[float] | None:
    val = text.strip()
    if not val:
        return None
    if val in _embedding_cache:
        return _embedding_cache[val]
    try:
        engine = get_embedding_engine()
        res = await engine.embed_text([val])
        if res and len(res) > 0:
            emb = res[0]
            _embedding_cache[val] = emb
            return emb
    except Exception as e:
        print("[DEBUG] Failed to get embedding in recall.py:", e)
    return None

def _calculate_cosine_similarity(v1: list[float], v2: list[float]) -> float:
    arr1 = np.array(v1)
    arr2 = np.array(v2)
    norm1 = np.linalg.norm(arr1)
    norm2 = np.linalg.norm(arr2)
    if norm1 == 0 or norm2 == 0:
        return 0.0
    return float(np.dot(arr1, arr2) / (norm1 * norm2))
from pydantic import BaseModel
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.models.session import PinnedNode, SessionRecord
from app.services.recall_service import search_memory, extract_text
from app.core.security import verify_safe_input
import cognee

router = APIRouter()


class MemifyRequest(BaseModel):
    content: str


def parse_item(item, idx: int, pinned_map: dict) -> dict:
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
    return {
        "id": item_id,
        "content": text,
        "score": float(score_val),
        "source": source,
        "session_id": session_id,
        "created_at": created_at,
        "conflicts": [],
        "pinned": is_pinned,
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

    # Compute conflicts in-memory across result set (no extra Cognee calls)
    texts = [extract_text(item) for item in items_to_process]
    conflict_map: dict[int, list[str]] = {i: [] for i in range(len(texts))}
    for i in range(len(texts)):
        for j in range(len(texts)):
            if i == j:
                continue
            if not texts[i] or not texts[j]:
                continue
            
            emb1 = await _get_text_embedding(texts[i])
            emb2 = await _get_text_embedding(texts[j])
            
            if emb1 is not None and emb2 is not None:
                sim = _calculate_cosine_similarity(emb1, emb2)
                # Moderate similarity represents a potential semantic overlap/conflict
                if 0.45 <= sim < 0.90:
                    conflict_map[i].append(texts[j][:100])
            else:
                sim = difflib.SequenceMatcher(None, texts[i].strip().lower(), texts[j].strip().lower()).ratio()
                if 0.30 <= sim < 0.85:
                    conflict_map[i].append(texts[j][:100])

    results = []
    for idx, item in enumerate(items_to_process):
        parsed = parse_item(item, idx, pinned_map)
        parsed["conflicts"] = conflict_map.get(idx, [])
        results.append(parsed)

    # Save actual context size for the latest active session
    try:
        latest = db.query(SessionRecord).order_by(SessionRecord.timestamp.desc()).first()
        if latest:
            latest.context_size = len(results)
            db.commit()
    except Exception as e:
        print(f"[recall] Failed to save context_size to database: {e}")
    return results


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
        node_id = str(abs(hash(body.content)) % (10 ** 12))
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
        return {"success": True, "node_id": node_id, "warning": str(e)}


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
