from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from app.core.database import get_db
from app.services.recall_service import get_all_sessions, get_session, search_memory
import cognee

router = APIRouter()


@router.get("/search")
async def search_cognee_memory(query: str):
    """Recall relevant memory from Cognee using a natural language query."""
    results = await search_memory(query)
    return {"query": query, "results": results}


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


@router.post("/{session_id}/forget")
async def forget_session(session_id: str, db: Session = Depends(get_db)):
    session_record = get_session(db, session_id)
    if not session_record:
        raise HTTPException(status_code=404, detail="Session not found")

    try:
        dataset_name = f"{session_record.project}_{session_record.branch}".replace("/", "_").replace("-", "_")
        await cognee.forget(dataset_name=dataset_name)
        session_record.status = "forgotten"
        db.commit()
        return {"status": "forgotten"}
    except Exception as e:
        print("Cognee forget error:", e)
        raise HTTPException(status_code=500, detail=f"Cognee forget failed: {str(e)}")


@router.post("/{session_id}/improve")
async def improve_session(session_id: str, db: Session = Depends(get_db)):
    session_record = get_session(db, session_id)
    if not session_record:
        raise HTTPException(status_code=404, detail="Session not found")

    try:
        contextualized_text = f"Project: {session_record.project}\nBranch: {session_record.branch}\nLog Content:\n{session_record.terminal_output}"
        await cognee.improve(contextualized_text)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    return {"status": "improved"}


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
