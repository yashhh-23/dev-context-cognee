from fastapi import APIRouter, Depends, HTTPException, Header
from sqlalchemy.orm import Session
from typing import Optional
from app.core.database import get_db
from app.services.recall_service import get_all_sessions, get_session
from app.core.byok import decrypt_data

router = APIRouter()


def _decrypt_session(s, byok_key: Optional[str]) -> dict:
    """Serialize a SessionRecord, decrypting terminal_output if a BYOK key is present."""
    raw_output = s.terminal_output or ""
    terminal_output = decrypt_data(raw_output, byok_key) if byok_key else raw_output

    return {
        "id":              s.id,
        "repo":            s.project,
        "branch":          s.branch or "main",
        "started_at":      s.timestamp.isoformat() if s.timestamp else "",
        "last_active":     s.timestamp.isoformat() if s.timestamp else "",
        "context_size":    s.context_size if getattr(s, "context_size", None) is not None else 1,
        "summary":         None,
        "terminal_output": terminal_output,
        "status":          getattr(s, "status", None),
    }


@router.get("/")
def list_sessions(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    x_byok_key: Optional[str] = Header(default=None),
):
    """Return sessions, decrypting terminal_output if X-BYOK-Key header is present."""
    sessions = get_all_sessions(db, skip=skip, limit=limit)
    return [_decrypt_session(s, x_byok_key) for s in sessions]


@router.get("/{session_id}")
def retrieve_session(
    session_id: str,
    db: Session = Depends(get_db),
    x_byok_key: Optional[str] = Header(default=None),
):
    """Return a single session, decrypting terminal_output if X-BYOK-Key header is present."""
    s = get_session(db, session_id)
    if not s:
        raise HTTPException(status_code=404, detail="Session not found")
    return _decrypt_session(s, x_byok_key)
