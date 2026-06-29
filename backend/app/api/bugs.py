from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.services.recall_service import get_session, search_memory
import httpx
import os
import re

router = APIRouter()

GITHUB_TOKEN = os.getenv("GITHUB_TOKEN", "")


class AnalyzeRequest(BaseModel):
    session_id: str


def extract_error_keyword(terminal_output: str) -> str:
    """Extract the most meaningful error keyword from terminal output."""
    patterns = [
        r"(\w+Error[:\s][^\n]{5,60})",
        r"(Error:[^\n]{5,60})",
        r"(FAILED[^\n]{5,50})",
        r"(Exception[:\s][^\n]{5,60})",
        r"(cannot [^\n]{5,50})",
        r"(ModuleNotFoundError[^\n]{0,60})",
    ]
    for pattern in patterns:
        match = re.search(pattern, terminal_output, re.IGNORECASE)
        if match:
            kw = match.group(1).strip()
            return kw[:80]
    # Fallback: first non-empty line with content
    for line in terminal_output.splitlines():
        line = line.strip()
        if len(line) > 10:
            return line[:80]
    return terminal_output[:80]


async def search_github_issues(keyword: str) -> list:
    """Search GitHub public issues matching the error keyword."""
    headers = {"Accept": "application/vnd.github+json"}
    if GITHUB_TOKEN:
        headers["Authorization"] = f"Bearer {GITHUB_TOKEN}"
    query = f"{keyword} in:title,body is:issue is:open"
    url = f"https://api.github.com/search/issues?q={httpx.URL('', params={'q': query}).params['q']}&per_page=5&sort=relevance"
    try:
        async with httpx.AsyncClient(timeout=8) as client:
            resp = await client.get(
                "https://api.github.com/search/issues",
                params={"q": query, "per_page": 5, "sort": "relevance"},
                headers=headers,
            )
        if resp.status_code == 200:
            items = resp.json().get("items", [])
            return [
                {
                    "title": item["title"],
                    "html_url": item["html_url"],
                    "repository": item["repository_url"].split("/")[-2] + "/" + item["repository_url"].split("/")[-1],
                    "state": item["state"],
                    "labels": [l["name"] for l in item.get("labels", [])],
                }
                for item in items
            ]
    except Exception as e:
        print("GitHub issues search error:", e)
    return []


async def search_github_contributions(keyword: str) -> list:
    """Search GitHub for good-first-issue / help-wanted matching the keyword."""
    headers = {"Accept": "application/vnd.github+json"}
    if GITHUB_TOKEN:
        headers["Authorization"] = f"Bearer {GITHUB_TOKEN}"
    query = f"{keyword} label:\"good first issue\" is:open is:issue"
    try:
        async with httpx.AsyncClient(timeout=8) as client:
            resp = await client.get(
                "https://api.github.com/search/issues",
                params={"q": query, "per_page": 5, "sort": "relevance"},
                headers=headers,
            )
        if resp.status_code == 200:
            items = resp.json().get("items", [])
            return [
                {
                    "title": item["title"],
                    "html_url": item["html_url"],
                    "repository": item["repository_url"].split("/")[-2] + "/" + item["repository_url"].split("/")[-1],
                    "labels": [l["name"] for l in item.get("labels", [])],
                    "stars": 0,
                }
                for item in items
            ]
    except Exception as e:
        print("GitHub contributions search error:", e)
    return []


@router.get("/")
async def get_bugs(limit: int = 30):
    return []

@router.post("/analyze")
async def analyze_bug(request: AnalyzeRequest, db: Session = Depends(get_db)):
    """Analyze a session: recall similar bugs from Cognee + search GitHub."""
    session_record = get_session(db, request.session_id)
    if not session_record:
        raise HTTPException(status_code=404, detail="Session not found")

    terminal_output = session_record.terminal_output or ""
    keyword = extract_error_keyword(terminal_output)

    # Recall similar bugs from Cognee memory
    try:
        similar = await search_memory(f"bug error: {keyword}")
        similar_bugs = similar if isinstance(similar, list) else []
    except Exception:
        similar_bugs = []

    # Search GitHub in parallel
    github_issues = await search_github_issues(keyword)
    contribution_opportunities = await search_github_contributions(keyword)

    return {
        "session_id": request.session_id,
        "keyword": keyword,
        "similar_past_bugs": similar_bugs,
        "github_issues": github_issues,
        "contribution_opportunities": contribution_opportunities,
    }


@router.get("/opportunities")
async def get_opportunities(db: Session = Depends(get_db)):
    """Return aggregated OSS contribution opportunities from recent sessions."""
    from app.services.recall_service import get_all_sessions

    sessions = get_all_sessions(db, skip=0, limit=10)
    all_opps: list = []
    seen_urls: set = set()

    headers = {"Accept": "application/vnd.github+json"}
    if GITHUB_TOKEN:
        headers["Authorization"] = f"Bearer {GITHUB_TOKEN}"

    # Deduplicate keywords from recent sessions
    keywords: list[str] = []
    for s in sessions:
        if s.terminal_output:
            kw = extract_error_keyword(s.terminal_output)
            if kw and kw not in keywords:
                keywords.append(kw)
        if len(keywords) >= 3:
            break

    for kw in keywords:
        opps = await search_github_contributions(kw)
        for opp in opps:
            if opp["html_url"] not in seen_urls:
                seen_urls.add(opp["html_url"])
                all_opps.append(opp)

    return {"opportunities": all_opps[:20]}
