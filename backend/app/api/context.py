from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.config import settings
from app.services.recall_service import recall_text
from app.models.session import SessionRecord

router = APIRouter()

@router.get("/summary")
async def get_context_summary(db: Session = Depends(get_db)):
    """Retrieve the summary of the last active project/branch from memory."""
    # Get last active session from the database
    last_session = db.query(SessionRecord).order_by(SessionRecord.timestamp.desc()).first()
    repo = last_session.project if last_session else (settings.GITHUB_REPO or "")
    branch = last_session.branch if last_session else "main"

    query = f"what was I last working on in {repo}" if repo else "what was I last working on"
    try:
        texts = await recall_text(query, limit=1)
        summary = texts[0] if texts else "No context summary found in memory."
        return {
            "repo": repo,
            "branch": branch,
            "summary": summary
        }
    except Exception as e:
        return {
            "repo": repo,
            "branch": branch,
            "summary": f"Error recalling summary: {str(e)}"
        }
