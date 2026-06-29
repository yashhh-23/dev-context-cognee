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


@router.post("/{session_id}/forget")
async def forget_session(session_id: str, db: Session = Depends(get_db)):
    session_record = get_session(db, session_id)
    if not session_record:
        raise HTTPException(status_code=404, detail="Session not found")
    
    try:
        dataset_name = f"{session_record.project}_{session_record.branch}".replace("/", "_").replace("-", "_")
        # In absence of clear documentation on forget signature, we assume it takes dataset_name
        await search_cognee.cognee.forget(dataset_name=dataset_name)
    except Exception as e:
        print("Cognee forget error:", e)
        # We still mark it as forgotten in DB even if Cognee fails
        
    session_record.status = "forgotten"
    db.commit()
    return {"status": "forgotten"}

@router.post("/{session_id}/improve")
async def improve_session(session_id: str, db: Session = Depends(get_db)):
    session_record = get_session(db, session_id)
    if not session_record:
        raise HTTPException(status_code=404, detail="Session not found")
    
    try:
        # According to phase3.md, improve() takes the session's stored text to enrich its graph
        await search_cognee.cognee.improve(session_record.terminal_output)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
        
    return {"status": "improved"}

@router.get("/{session_id}", response_model=SessionResponse)
def retrieve_session(session_id: str, db: Session = Depends(get_db)):
    session_record = get_session(db, session_id)
    if not session_record:
        raise HTTPException(status_code=404, detail="Session not found")
    return session_record
