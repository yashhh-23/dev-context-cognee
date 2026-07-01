from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from app.services.memify_service import improve_context

router = APIRouter()


class MemifyPayload(BaseModel):
    filename: str
    content: str
    language: str = "unknown"


@router.post("/memify")
async def memify_endpoint(payload: MemifyPayload):
    """Improve / re-ingest a context into Cognee knowledge graph."""
    if not payload.filename or not payload.content:
        raise HTTPException(status_code=400, detail="filename and content are required")

    result = await improve_context(
        filename=payload.filename,
        content=payload.content,
        language=payload.language,
    )
    return result
