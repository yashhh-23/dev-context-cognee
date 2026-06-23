from fastapi import APIRouter, Depends, BackgroundTasks, HTTPException
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.models.ingest import IngestRequest, IngestResponse
from app.models.session import SessionRecord
from app.services.ingest_service import process_ingest
import datetime

router = APIRouter()


@router.post("/", response_model=IngestResponse)
def ingest_log(req: IngestRequest, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    # Guard: never pass None as timestamp — SQLAlchemy default only fires when field is omitted
    ts = req.timestamp if req.timestamp is not None else datetime.datetime.utcnow()

    new_session = SessionRecord(
        project=req.project,
        branch=req.branch,
        terminal_output=req.terminal_output,
        tags=req.tags,
        github_url=req.github_url,
        timestamp=ts,
        status="queued",
    )
    db.add(new_session)
    db.commit()
    db.refresh(new_session)

    background_tasks.add_task(process_ingest, new_session.id, req.model_dump())

    return {"session_id": new_session.id, "status": "queued"}


@router.get("/{job_id}/status")
def get_ingest_status(job_id: str, db: Session = Depends(get_db)):
    session_record = db.query(SessionRecord).filter(SessionRecord.id == job_id).first()
    if not session_record:
        raise HTTPException(status_code=404, detail="Job not found")

    return {
        "session_id": session_record.id,
        "status":     session_record.status,
        "error_message": session_record.error_message,
    }
