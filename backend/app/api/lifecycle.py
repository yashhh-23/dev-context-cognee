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


@router.post("/memories/auto-clean")
async def auto_clean_memories(db: Session = Depends(get_db)):
    """Deduplicate memories using the existing is_duplicate logic."""
    from app.models.session import SessionRecord
    import difflib

    # Fetch all completed sessions ordered by timestamp (oldest first)
    sessions = (
        db.query(SessionRecord)
        .filter(SessionRecord.status == "completed")
        .order_by(SessionRecord.timestamp.asc())
        .all()
    )

    cleaned_count = 0
    seen_texts = []

    for session in sessions:
        text = session.terminal_output or ""
        if not text.strip():
            continue

        # Check if this text is a duplicate of any session we've already kept
        is_dup = False
        for seen in seen_texts:
            similarity = difflib.SequenceMatcher(None, text.strip().lower(), seen.strip().lower()).ratio()
            if similarity >= 0.85 or text.strip().lower() in seen.strip().lower() or seen.strip().lower() in text.strip().lower():
                is_dup = True
                break

        if is_dup:
            # It's a duplicate! Remove from Cognee and mark as forgotten in DB
            try:
                dataset_name = (
                    f"{session.project}_{session.branch}"
                    .replace("/", "_")
                    .replace("-", "_")
                )
                await cognee.forget(dataset_name=dataset_name)
                session.status = "forgotten"
                cleaned_count += 1
            except Exception as e:
                print(f"[auto-clean] Error forgetting duplicate session {session.id}: {e}")
        else:
            seen_texts.append(text)

    if cleaned_count > 0:
        db.commit()

    return {
        "status": "success",
        "cleaned_count": cleaned_count,
        "message": f"Successfully cleaned {cleaned_count} duplicate memories."
    }
