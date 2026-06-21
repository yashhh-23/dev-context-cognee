import re
from sqlalchemy.orm import Session
from app.models.session import SessionRecord
import cognee
import asyncio

def clean_terminal_output(text: str) -> str:
    # Remove obvious secrets (simple heuristic for example)
    text = re.sub(r'(api[_\-]?key|secret|token|password)[\s:=]+[\'"]?[A-Za-z0-9_\-\.]+[\'"]?', r'\1: [REDACTED]', text, flags=re.IGNORECASE)
    
    # Strip ANSI escape codes
    ansi_escape = re.compile(r'\x1B(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~])')
    text = ansi_escape.sub('', text)
    
    # Truncate huge logs to avoid blowing up context window (e.g. 50k chars)
    max_length = 50000
    if len(text) > max_length:
        text = text[:max_length] + "\n...[TRUNCATED]"
        
    return text

from app.core.database import SessionLocal

async def process_ingest(session_id: str, payload: dict):
    db = SessionLocal()
    try:
        # Fetch the session record from DB
        session_record = db.query(SessionRecord).filter(SessionRecord.id == session_id).first()
    
    if not session_record:
        return
        
    try:
        session_record.status = "processing"
        db.commit()

        cleaned_text = clean_terminal_output(payload.get("terminal_output", ""))
        
        # Prepare context payload for Cognee
        project = payload.get("project", "unknown_project")
        branch = payload.get("branch", "unknown_branch")
        
        # Add a prefix to provide context to the LLM when recalling
        contextualized_text = f"Project: {project}\nBranch: {branch}\nLog Content:\n{cleaned_text}"
        
        # Cognee is async, so we await it
        # Actually according to docs `cognee.remember` doesn't always need dataset naming, but we will pass it simply as text.
        await cognee.remember(contextualized_text)
        
        session_record.status = "completed"
        # we could also store the cognee response ID if returned
        db.commit()
    except Exception as e:
        session_record.status = "failed"
        session_record.error_message = str(e)
        db.commit()
    finally:
        db.close()
