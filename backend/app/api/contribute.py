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


@router.get("")
async def list_contribute():
    """Return good-first-issues and help-wanted from the configured repo."""
    from app.api.bugs import GITHUB_TOKEN
    import httpx, os

    repo = os.getenv("GITHUB_REPO", "")
    if not repo:
        return []

    headers = {"Accept": "application/vnd.github+json"}
    if GITHUB_TOKEN:
        headers["Authorization"] = f"Bearer {GITHUB_TOKEN}"

    results = []
    for label in ["good first issue", "help wanted"]:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(
                f"https://api.github.com/repos/{repo}/issues",
                params={"state": "open", "labels": label, "per_page": 10},
                headers=headers,
            )
        if resp.status_code == 200:
            for item in resp.json():
                if "pull_request" not in item:
                    results.append({
                        "title":      item["title"],
                        "html_url":   item["html_url"],
                        "repository": repo,
                        "labels":     [l["name"] for l in item.get("labels", [])],
                        "difficulty": "beginner" if "good first issue" in label else "intermediate",
                        "number":     item["number"],
                    })
    return results

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
