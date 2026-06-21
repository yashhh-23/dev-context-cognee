from fastapi import APIRouter, Depends, BackgroundTasks, HTTPException
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.models.ingest import IngestRequest, IngestResponse
from app.models.session import SessionRecord
from app.services.ingest_service import process_ingest
import asyncio

router = APIRouter()

@router.post("/", response_model=IngestResponse)
def ingest_log(req: IngestRequest, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    # Create session record in DB immediately
    new_session = SessionRecord(
        project=req.project,
        branch=req.branch,
        terminal_output=req.terminal_output,
        tags=req.tags,
        github_url=req.github_url,
        timestamp=req.timestamp,
        status="queued"
    )
    db.add(new_session)
    db.commit()
    db.refresh(new_session)
    
    # We need to run process_ingest in the background.
    # process_ingest is async, background_tasks in FastAPI supports async since 0.70+
    # FastAPI's BackgroundTasks will run this async function in the event loop automatically.
    background_tasks.add_task(process_ingest, new_session.id, req.model_dump())
    
    return {"session_id": new_session.id, "status": "queued"}

@router.get("/{job_id}/status")
def get_ingest_status(job_id: str, db: Session = Depends(get_db)):
    session_record = db.query(SessionRecord).filter(SessionRecord.id == job_id).first()
    if not session_record:
        raise HTTPException(status_code=404, detail="Job not found")
    
    return {
        "session_id": session_record.id,
        "status": session_record.status,
        "error_message": session_record.error_message
    }
