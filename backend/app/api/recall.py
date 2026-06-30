"""Recall API — search, memify, and forget Cognee memory nodes."""
import asyncio
import difflib
from fastapi import APIRouter, Query, HTTPException, Depends
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


def parse_item(item, idx: int, db: Session) -> dict:
    text = extract_text(item)

    # Extract structured metadata where available
    if isinstance(item, dict):
        score_val = item.get("score") or item.get("relevance") or 1.0
        item_id   = item.get("id") or item.get("node_id") or str(idx)
        source    = item.get("source", "cognee")
        session_id = item.get("session_id")
        created_at = item.get("created_at")
    else:
        score_val  = getattr(item, "score", None) or getattr(item, "relevance", 1.0) or 1.0
        item_id    = str(getattr(item, "id", idx))
        source     = getattr(item, "source", "cognee")
        session_id = getattr(item, "session_id", None)
        created_at = getattr(item, "created_at", None)

    # Check if pinned in database
    pinned_record = db.query(PinnedNode).filter(PinnedNode.node_id == item_id).first()
    is_pinned = pinned_record.pinned if pinned_record else False

    return {
        "id":         item_id,
        "content":    text,
        "score":      float(score_val),
        "source":     source,
        "session_id": session_id,
        "created_at": created_at,
        "conflicts":  [],
        "pinned":     is_pinned,
    }


@router.get("/")
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

    # Parse all items to populate structure and check pins
    results = [parse_item(item, idx, db) for idx, item in enumerate(items_to_process)]

    # Compute conflicts in-memory
    for i, item_a in enumerate(results):
        text_a = (item_a["content"] or "").strip().lower()
        if not text_a:
            continue
        for j, item_b in enumerate(results):
            if i == j:
                continue
            text_b = (item_b["content"] or "").strip().lower()
            if not text_b or text_a == text_b:
                continue

            similarity = difflib.SequenceMatcher(None, text_a, text_b).ratio()
            if 0.30 <= similarity < 0.85:
                item_a["conflicts"].append(item_b["content"][:100])

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
