"""GET /recall — natural language query against Cognee memory."""
from fastapi import APIRouter, Query
from app.services.recall_service import search_memory

router = APIRouter()


@router.get("/")
async def recall(q: str = Query(..., description="Natural language query"),
                 limit: int = Query(5, ge=1, le=20)):
    """Recall relevant memory nodes from Cognee hybrid store."""
    try:
        raw = await search_memory(q)
    except Exception as e:
        return {"query": q, "results": [], "error": str(e)}

    results = []
    if isinstance(raw, list):
        for item in raw[:limit]:
            if isinstance(item, dict):
                results.append(item)
            elif hasattr(item, "__dict__"):
                results.append(item.__dict__)
            else:
                results.append({"text": str(item)})
    elif raw:
        results.append({"text": str(raw)})

    return {"query": q, "total": len(results), "results": results}
