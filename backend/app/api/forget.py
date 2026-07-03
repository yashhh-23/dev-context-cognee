from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from app.services.forget_service import forget_context

router = APIRouter()


class ForgetPayload(BaseModel):
    filename: str | None = None
    session_id: str | None = None


@router.post("/forget")
async def forget_endpoint(payload: ForgetPayload):
    """Delete a saved context from Cognee knowledge graph."""
    if not payload.filename and not payload.session_id:
        raise HTTPException(status_code=400, detail="filename or session_id is required")

    result = await forget_context(session_id=payload.session_id, filename=payload.filename)
    if result.get("status") == "error" and "No deletion target found" in result.get("error", ""):
        raise HTTPException(status_code=404, detail=result["error"])
    return result
