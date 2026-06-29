"""GET /contribute/search — similar GitHub issues + contribution opportunities."""
from fastapi import APIRouter, Query, HTTPException
from app.api.bugs import (
    extract_error_keyword,
    search_github_issues,
    search_github_contributions,
)
from app.core.database import get_db
from app.services.recall_service import get_session
from fastapi import Depends
from sqlalchemy.orm import Session

router = APIRouter()


@router.get("/search")
async def contribute_search(
    session_id: str = Query(None, description="Search based on a specific session's error"),
    q: str = Query(None, description="Manual search query"),
    db: Session = Depends(get_db),
):
    """Search GitHub for similar open issues and contribution opportunities."""
    if not session_id and not q:
        raise HTTPException(status_code=400, detail="Provide session_id or q")

    keyword = q
    if session_id and not keyword:
        record = get_session(db, session_id)
        if not record:
            raise HTTPException(status_code=404, detail="Session not found")
        keyword = extract_error_keyword(record.terminal_output or "")

    similar_bugs = await search_github_issues(keyword)
    opportunities = await search_github_contributions(keyword)

    return {
        "keyword": keyword,
        "similar_bugs": similar_bugs,
        "opportunities": opportunities,
    }
