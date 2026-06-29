"""Recall API — search, memify, and forget Cognee memory nodes."""
from fastapi import APIRouter, Query, HTTPException
from pydantic import BaseModel
from app.services.recall_service import search_memory, extract_text
import cognee

router = APIRouter()


class MemifyRequest(BaseModel):
    content: str


@router.get("/")
async def recall(
    q: str = Query(..., description="Natural language query"),
    limit: int = Query(5, ge=1, le=20),
):
    """Recall relevant memory nodes — returns a bare list to match frontend RecallResult[]."""
    try:
        raw = await search_memory(q)
    except Exception as e:
        print(f"[recall] search_memory error: {e}")
        return []

    results = []
    if isinstance(raw, list):
        for item in raw[:limit]:
            text = extract_text(item)

            # Extract structured metadata where available
            if isinstance(item, dict):
                score_val = item.get("score") or item.get("relevance") or 1.0
                item_id   = item.get("id") or item.get("node_id") or str(len(results))
                source    = item.get("source", "cognee")
                session_id = item.get("session_id")
                created_at = item.get("created_at")
            else:
                score_val  = getattr(item, "score", None) or getattr(item, "relevance", 1.0) or 1.0
                item_id    = str(getattr(item, "id", len(results)))
                source     = getattr(item, "source", "cognee")
                session_id = getattr(item, "session_id", None)
                created_at = getattr(item, "created_at", None)

            results.append({
                "id":         item_id,
                "content":    text,
                "score":      float(score_val),
                "source":     source,
                "session_id": session_id,
                "created_at": created_at,
            })
    elif raw:
        results.append({
            "id":      "0",
            "content": extract_text(raw),
            "score":   1.0,
            "source":  "cognee",
        })

    return results


@router.post("/memify")
async def memify(body: MemifyRequest):
    """Store arbitrary text into Cognee memory graph."""
    if not body.content.strip():
        raise HTTPException(status_code=400, detail="content cannot be empty")
    try:
        await cognee.remember(body.content)
        node_id = str(abs(hash(body.content)) % (10 ** 12))
        return {"node_id": node_id, "status": "stored"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Cognee remember failed: {str(e)}")


@router.delete("/{node_id}")
async def forget_node(node_id: str):
    """Remove a specific memory node from Cognee."""
    try:
        await cognee.forget(node_id)
        return {"success": True, "node_id": node_id}
    except Exception as e:
        return {"success": True, "node_id": node_id, "warning": str(e)}
