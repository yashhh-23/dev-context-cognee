"""POST /improve/{session_id} and DELETE /forget/{session_id}."""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from typing import Optional
from app.core.database import get_db
from app.services.recall_service import get_session
from app.core.ws_manager import manager
import cognee

router = APIRouter()


class ImproveRequest(BaseModel):
    fix_text: Optional[str] = None


@router.post("/improve/{session_id}")
async def improve_session(session_id: str,
                          body: ImproveRequest,
                          db: Session = Depends(get_db)):
    """Mark a session resolved and call cognee.improve() to update the memory embedding."""
    record = get_session(db, session_id)
    if not record:
        raise HTTPException(status_code=404, detail="Session not found")

    fix_note = body.fix_text or ""
    context = (
        f"RESOLVED — Project: {record.project} | Branch: {record.branch}\n"
        f"Original log:\n{(record.terminal_output or '')[:1000]}\n"
        f"Fix applied: {fix_note}"
    )
    try:
        await cognee.improve(context)
        record.status = "resolved"
        db.commit()
    except Exception as e:
        # Graceful: update DB even if Cognee improve fails
        record.status = "resolved"
        record.error_message = f"cognee.improve warning: {str(e)}"
        db.commit()

    await manager.broadcast({"type": "session_resolved", "session_id": session_id})
    return {"status": "resolved", "session_id": session_id}


@router.delete("/forget/{session_id}")
async def forget_session(session_id: str, db: Session = Depends(get_db)):
    """Remove session from Cognee memory and mark forgotten in DB."""
    record = get_session(db, session_id)
    if not record:
        raise HTTPException(status_code=404, detail="Session not found")

    try:
        dataset_name = (
            f"{record.project}_{record.branch}"
            .replace("/", "_")
            .replace("-", "_")
        )
        await cognee.forget(dataset_name=dataset_name)
        record.status = "forgotten"
        db.commit()
    except Exception as e:
        record.status = "forgotten"
        record.error_message = f"cognee.forget warning: {str(e)}"
        db.commit()

    await manager.broadcast({"type": "session_forgotten", "session_id": session_id})
    return {"status": "forgotten", "session_id": session_id}
