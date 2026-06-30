"""Recall API — search, memify, and forget Cognee memory nodes."""
from fastapi import APIRouter, Query, HTTPException
from pydantic import BaseModel
from app.services.recall_service import search_memory
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
        return []

    results = []
    if isinstance(raw, list):
        for item in raw[:limit]:
            if isinstance(item, dict):
                score_val = item.get("score")
                if score_val is None:
                    score_val = item.get("relevance", 1.0)
                if score_val is None:
                    score_val = 1.0

                results.append({
                    "id":         item.get("id", item.get("node_id", str(len(results)))),
                    "content":    item.get("content", item.get("text", str(item))),
                    "score":      float(score_val),
                    "source":     item.get("source", "cognee"),
                    "session_id": item.get("session_id"),
                    "created_at": item.get("created_at"),
                })
            elif hasattr(item, "__dict__"):
                score_val = getattr(item, "score", None)
                if score_val is None:
                    score_val = getattr(item, "relevance", 1.0)
                if score_val is None:
                    score_val = 1.0

                results.append({
                    "id":         str(getattr(item, "id", len(results))),
                    "content":    getattr(item, "content", getattr(item, "text", str(item))),
                    "score":      float(score_val),
                    "source":     getattr(item, "source", "cognee"),
                    "session_id": getattr(item, "session_id", None),
                    "created_at": getattr(item, "created_at", None),
                })
            else:
                results.append({
                    "id":      str(len(results)),
                    "content": str(item),
                    "score":   1.0,
                    "source":  "cognee",
                })
    elif raw:
        results.append({"id": "0", "content": str(raw), "score": 1.0, "source": "cognee"})

    return results


@router.post("/memify")
async def memify(body: MemifyRequest):
    """Store arbitrary text into Cognee memory graph."""
    if not body.content.strip():
        raise HTTPException(status_code=400, detail="content cannot be empty")
    try:
        await cognee.remember(body.content)
        # Cognee does not reliably return a node ID from remember(); use a hash as stable ID
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
        # Graceful: if node doesn't exist, still return success
        return {"success": True, "node_id": node_id, "warning": str(e)}
