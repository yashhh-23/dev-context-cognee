"""GET /contribute — list good-first-issues and help-wanted from GITHUB_REPO."""
from fastapi import APIRouter, Query, HTTPException
from app.api.bugs import (
    extract_error_keyword,
    search_github_issues,
    search_github_contributions,
    GITHUB_TOKEN,
    GITHUB_REPO,
)
from app.core.database import get_db
from app.services.recall_service import get_session
from fastapi import Depends
from sqlalchemy.orm import Session
import httpx

router = APIRouter()


@router.get("")
async def list_contribute():
    """Return good-first-issues and help-wanted from the configured GITHUB_REPO."""
    if not GITHUB_REPO:
        return []

    headers = {"Accept": "application/vnd.github+json"}
    if GITHUB_TOKEN:
        headers["Authorization"] = f"Bearer {GITHUB_TOKEN}"

    results, seen = [], set()
    for label in ["good first issue", "help wanted"]:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(
                f"https://api.github.com/repos/{GITHUB_REPO}/issues",
                params={"state": "open", "labels": label, "per_page": 15},
                headers=headers,
            )
        if resp.status_code == 200:
            for item in resp.json():
                if "pull_request" not in item and item["number"] not in seen:
                    seen.add(item["number"])
                    results.append({
                        "id":         item["number"],
                        "title":      item["title"],
                        "url":        item["html_url"],
                        "repo":       GITHUB_REPO,
                        "type":       "good-first-issue" if "good first issue" in label else "help-wanted",
                        "difficulty": "easy" if "good first issue" in label else "medium",
                        "suggestion": "",
                        "labels":     [l["name"] for l in item.get("labels", [])],
                    })
    return results


@router.get("/search")
async def contribute_search(
    session_id: str = Query(None, description="Search based on a specific session's error"),
    keyword: str = Query(None, description="Direct keyword search"),
    db: Session = Depends(get_db),
):
    """Search GitHub for contribution opportunities based on session error or keyword."""
    if session_id:
        session = get_session(db, session_id)
        if not session:
            raise HTTPException(status_code=404, detail="Session not found")
        kw = extract_error_keyword(session.terminal_output or "")
    elif keyword:
        kw = keyword
    else:
        raise HTTPException(status_code=400, detail="Provide session_id or keyword")

    issues = await search_github_issues(kw)
    contributions = await search_github_contributions(kw)

    return {
        "keyword": kw,
        "github_issues": issues,
        "contribution_opportunities": contributions,
    }
