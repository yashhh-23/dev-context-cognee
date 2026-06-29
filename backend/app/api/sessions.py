from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from app.core.database import get_db
from app.models.ingest import SessionResponse
from app.services.recall_service import get_all_sessions, get_session, search_memory

router = APIRouter()


@router.get("/search")
async def search_cognee_memory(query: str):
    """Recall relevant memory from Cognee using a natural language query."""
    results = await search_memory(query)
    return {"query": query, "results": results}


@router.get("/", response_model=List[SessionResponse])
def list_sessions(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    sessions = get_all_sessions(db, skip=skip, limit=limit)
    return sessions


@router.get("/{session_id}", response_model=SessionResponse)
def retrieve_session(session_id: str, db: Session = Depends(get_db)):
    session_record = get_session(db, session_id)
    if not session_record:
        raise HTTPException(status_code=404, detail="Session not found")
    return session_record
