from fastapi import APIRouter
from typing import Optional
import cognee

router = APIRouter()

@router.get("/summary")
async def get_context_summary(project: Optional[str] = None):
    query = f"what was I last working on in {project}" if project else "what was I last working on"
    try:
        results = await cognee.search(query)
        return {"query": query, "summary": results}
    except Exception as e:
        return {"query": query, "error": str(e)}
