from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from app.core.database import get_db
from app.services.recall_service import get_all_sessions, get_session

router = APIRouter()


@router.get("/")
def list_sessions(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    """Return sessions in the shape the frontend Session interface expects."""
    sessions = get_all_sessions(db, skip=skip, limit=limit)
    return [
        {
            "id":           s.id,
            "repo":         s.project,                                        # project → repo
            "branch":       s.branch or "main",
            "started_at":   s.timestamp.isoformat() if s.timestamp else "",   # timestamp → started_at
            "last_active":  s.timestamp.isoformat() if s.timestamp else "",   # same field — no separate column yet
            "context_size": 1,                                                 # placeholder; upgrade when Cognee node count per session is available
            "summary":      None,
        }
        for s in sessions
    ]





@router.get("/{session_id}")
def retrieve_session(session_id: str, db: Session = Depends(get_db)):
    s = get_session(db, session_id)
    if not s:
        raise HTTPException(status_code=404, detail="Session not found")
    return {
        "id":           s.id,
        "repo":         s.project,
        "branch":       s.branch or "main",
        "started_at":   s.timestamp.isoformat() if s.timestamp else "",
        "last_active":  s.timestamp.isoformat() if s.timestamp else "",
        "context_size": 1,
        "summary":      None,
    }
