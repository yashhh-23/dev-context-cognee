"""GET /contribute — list good-first-issues and help-wanted from Cognee + OSS repos."""
from fastapi import APIRouter, Query, HTTPException
from app.api.bugs import (
    extract_error_keyword,
    search_github_issues,
    search_github_contributions,
)
from app.core.config import settings
from app.core.database import get_db
from app.services.recall_service import get_session, search_memory
from fastapi import Depends
from sqlalchemy.orm import Session
import httpx

router = APIRouter()

# OSS repos to surface contribution opportunities from.
# topoteretes/cognee is always first (hackathon context).
OSS_REPOS = [
    "topoteretes/cognee",
    "BerriAI/litellm",
    "tiangolo/fastapi",
    "vercel/next.js",
    "sqlalchemy/sqlalchemy",
]


def _gh_headers() -> dict:
    h = {"Accept": "application/vnd.github+json"}
    token = settings.GITHUB_TOKEN
    if token:
        h["Authorization"] = f"Bearer {token}"
    return h


@router.get("")
async def list_contribute():
    """Return good-first-issues and help-wanted from Cognee + OSS repos."""
    headers = _gh_headers()

    repos = list(OSS_REPOS)
    user_repo = settings.GITHUB_REPO
    if user_repo and user_repo not in repos:
        repos.append(user_repo)

    results, seen = [], set()

    for repo in repos:
        for label in ["good first issue", "help wanted"]:
            try:
                async with httpx.AsyncClient(timeout=10) as client:
                    resp = await client.get(
                        f"https://api.github.com/repos/{repo}/issues",
                        params={"state": "open", "labels": label, "per_page": 10},
                        headers=headers,
                    )
                if resp.status_code != 200:
                    continue
                for item in resp.json():
                    uid = f"{repo}#{item['number']}"
                    if "pull_request" in item or uid in seen:
                        continue
                    seen.add(uid)
                    results.append({
                        "id":         item["number"],
                        "title":      item["title"],
                        "url":        item["html_url"],
                        "repo":       repo,
                        "type":       "good-first-issue" if label == "good first issue" else "help-wanted",
                        "difficulty": "easy" if label == "good first issue" else "medium",
                        "suggestion": "",
                        "labels":     [l["name"] for l in item.get("labels", [])],
                    })
            except Exception as e:
                print(f"[contribute] error fetching {repo} / {label}: {e}")
                continue

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


@router.get("/{issue_id}/suggest")
async def suggest_contribution(issue_id: int):
    """Use Cognee recall to generate a contribution suggestion for a given issue ID."""
    try:
        query = f"contribution approach for GitHub issue #{issue_id}"
        raw = await search_memory(query)

        suggestion = ""
        if isinstance(raw, list) and raw:
            first = raw[0]
            if isinstance(first, dict):
                suggestion = first.get("content", first.get("text", ""))
            elif hasattr(first, "content"):
                suggestion = first.content
            else:
                suggestion = str(first)
        elif raw:
            suggestion = str(raw)

        if not suggestion:
            suggestion = (
                f"Based on your recent sessions, issue #{issue_id} may relate to a known pattern. "
                "Review your recent error logs for similar stack traces and check if existing fixes can be adapted."
            )

        return {"suggestion": suggestion}
    except Exception as e:
        return {
            "suggestion": (
                f"Could not recall context from Cognee memory (reason: {str(e)}). "
                "Try ingesting a related session first."
            )
        }
