from fastapi import APIRouter, Depends, BackgroundTasks, HTTPException, Header
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.models.ingest import IngestRequest, IngestResponse
from app.models.session import SessionRecord
from app.services.ingest_service import process_ingest, process_file_ingest
from app.core.security import verify_safe_input
from app.core.byok import encrypt_data
from typing import Optional
import datetime

router = APIRouter()


@router.post("/", response_model=IngestResponse)
def ingest_log(
    req: IngestRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    x_byok_key: Optional[str] = Header(None),
):
    # Guard: verify inputs are safe from prompt injection
    if req.project:
        verify_safe_input(req.project, "project")
    if req.branch:
        verify_safe_input(req.branch, "branch")
    if req.tags:
        for tag in req.tags:
            verify_safe_input(tag, "tag")

    # Guard: both content and terminal_output cannot be None
    if req.terminal_output is None and req.content is None:
        raise HTTPException(status_code=422, detail="Either content or terminal_output must be provided")

    if req.terminal_output and len(req.terminal_output) > 100_000:
        raise HTTPException(status_code=400, detail="Log too large")

    # Guard: server controls timestamp to prevent client spoofing
    ts = datetime.datetime.now(datetime.timezone.utc)

    if req.content is not None:
        # File context ingestion from VS Code extension
        terminal_output_raw = f"[File Context Ingested: {req.fileName}]"
        if x_byok_key:
            terminal_output_raw = encrypt_data(terminal_output_raw, x_byok_key)
        new_session = SessionRecord(
            project=req.fileName or "file-ingest",
            branch=req.branch or "main",
            terminal_output=terminal_output_raw,
            tags=req.tags,
            timestamp=ts,
            status="queued",
        )
        db.add(new_session)
        db.commit()
        db.refresh(new_session)

        background_tasks.add_task(process_file_ingest, new_session.id, req.model_dump())
        return {"session_id": new_session.id, "status": "queued"}

    # Encrypt terminal output if BYOK key is provided
    encrypted_output = req.terminal_output or ""
    if x_byok_key and req.terminal_output:
        encrypted_output = encrypt_data(req.terminal_output, x_byok_key)

    new_session = SessionRecord(
        project=req.project or "unknown_project",
        branch=req.branch or "main",
        terminal_output=encrypted_output,
        tags=req.tags,
        github_url=req.github_url,
        timestamp=ts,
        status="queued",
    )
    db.add(new_session)
    db.commit()
    db.refresh(new_session)

    background_tasks.add_task(process_ingest, new_session.id, req.model_dump(), x_byok_key)

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
