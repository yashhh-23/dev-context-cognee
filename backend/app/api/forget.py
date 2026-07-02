from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from app.services.forget_service import forget_context

router = APIRouter()


class ForgetPayload(BaseModel):
    filename: str


@router.post("/forget")
async def forget_endpoint(payload: ForgetPayload):
    """Delete a saved context from Cognee knowledge graph."""
    if not payload.filename:
        raise HTTPException(status_code=400, detail="filename is required")

    result = await forget_context(filename=payload.filename)
    return result
