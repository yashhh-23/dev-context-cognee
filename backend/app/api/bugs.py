"""Bugs API — list open GitHub issues + analyze sessions for bug context."""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.config import settings
from app.services.recall_service import get_session, search_memory, recall_text, extract_text
import httpx
import re

from app.core.github_utils import _gh_headers

router = APIRouter()


class AnalyzeRequest(BaseModel):
    session_id: str


def _map_severity(labels: list) -> str:
    names = [l["name"].lower() for l in labels]
    if any("critical" in n for n in names): return "critical"
    if any("high" in n or "bug" in n for n in names): return "high"
    if any("medium" in n or "enhancement" in n for n in names): return "medium"
    return "low"


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
            return match.group(1).strip()[:80]
    for line in terminal_output.splitlines():
        line = line.strip()
        if len(line) > 10:
            return line[:80]
    return terminal_output[:80]


async def search_github_issues(keyword: str) -> list:
    headers = _gh_headers()
    query = f"{keyword} in:title,body is:issue is:open"
    try:
        async with httpx.AsyncClient(timeout=8) as client:
            resp = await client.get(
                "https://api.github.com/search/issues",
                params={"q": query, "per_page": 5, "sort": "relevance"},
                headers=headers,
            )
        if resp.status_code == 200:
            return [
                {
                    "title":      item["title"],
                    "html_url":   item["html_url"],
                    "repository": item["repository_url"].split("/")[-2] + "/" + item["repository_url"].split("/")[-1],
                    "state":      item["state"],
                    "labels":     [l["name"] for l in item.get("labels", [])],
                }
                for item in resp.json().get("items", [])
            ]
    except Exception as e:
        print(f"[bugs] search_github_issues error: {e}")
    return []


async def search_github_contributions(keyword: str) -> list:
    headers = _gh_headers()
    query = f'{keyword} label:"good first issue" is:open is:issue'
    try:
        async with httpx.AsyncClient(timeout=8) as client:
            resp = await client.get(
                "https://api.github.com/search/issues",
                params={"q": query, "per_page": 5, "sort": "relevance"},
                headers=headers,
            )
        if resp.status_code == 200:
            return [
                {
                    "title":      item["title"],
                    "html_url":   item["html_url"],
                    "repository": item["repository_url"].split("/")[-2] + "/" + item["repository_url"].split("/")[-1],
                    "labels":     [l["name"] for l in item.get("labels", [])],
                    "stars":      0,
                }
                for item in resp.json().get("items", [])
            ]
    except Exception as e:
        print(f"[bugs] search_github_contributions error: {e}")
    return []


@router.get("")
async def list_bugs(limit: int = 30):
    """Return open issues from the configured GITHUB_REPO."""
    repo = settings.GITHUB_REPO or ""
    if not repo:
        print("[bugs] GITHUB_REPO not set — returning empty list")
        return []

    headers = _gh_headers()
    print(f"[bugs] fetching issues from {repo}")

    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(
                f"https://api.github.com/repos/{repo}/issues",
                params={"state": "open", "per_page": limit, "sort": "created", "direction": "desc"},
                headers=headers,
            )

        print(f"[bugs] GitHub response status: {resp.status_code}")
        if resp.status_code != 200:
            print(f"[bugs] GitHub error body: {resp.text[:300]}")
            return []

        items = [item for item in resp.json() if "pull_request" not in item]
        print(f"[bugs] returning {len(items)} issues")
        return [
            {
                "id":       item["number"],
                "title":    item["title"],
                "severity": _map_severity(item.get("labels", [])),
                "author":   item["user"]["login"],
                "created":  item["created_at"],
                "url":      item["html_url"],
                "labels":   [l["name"] for l in item.get("labels", [])],
            }
            for item in items
        ]
    except Exception as e:
        print(f"[bugs] list_bugs exception: {e}")
        return []


@router.get("/{bug_id}/recall")
async def recall_bug_context(bug_id: int):
    """Use Cognee memory to recall context relevant to a specific GitHub issue."""
    issue_title = ""
    repo = settings.GITHUB_REPO or ""
    if repo:
        try:
            async with httpx.AsyncClient(timeout=6) as client:
                r = await client.get(
                    f"https://api.github.com/repos/{repo}/issues/{bug_id}",
                    headers=_gh_headers(),
                )
            if r.status_code == 200:
                issue_title = r.json().get("title", "")
        except Exception:
            pass

    query = f"bug #{bug_id}: {issue_title}" if issue_title else f"GitHub issue #{bug_id}"
    print(f"[bugs] recall query: {query}")

    texts = await recall_text(query, limit=5)

    if texts:
        context = "\n\n".join(f"— {t}" for t in texts)
    else:
        context = (
            f"No related memory found for issue #{bug_id}.\n\n"
            "Tip: ingest a session where you worked on a similar error — "
            "Cognee will then surface relevant context here automatically."
        )

    return {"context": context}


@router.post("/analyze")
async def analyze_bug(request: AnalyzeRequest, db: Session = Depends(get_db)):
    """Analyze a session: recall similar bugs from Cognee + search GitHub."""
    session_record = get_session(db, request.session_id)
    if not session_record:
        raise HTTPException(status_code=404, detail="Session not found")

    terminal_output = session_record.terminal_output or ""
    keyword = extract_error_keyword(terminal_output)

    try:
        raw = await search_memory(f"bug error: {keyword}")
        similar_bugs = [
            extract_text(item)
            for item in (raw if isinstance(raw, list) else [])
            if extract_text(item)
        ]
    except Exception:
        similar_bugs = []

    github_issues = await search_github_issues(keyword)
    contribution_opportunities = await search_github_contributions(keyword)

    return {
        "session_id":                 request.session_id,
        "keyword":                    keyword,
        "similar_past_bugs":          similar_bugs,
        "github_issues":              github_issues,
        "contribution_opportunities": contribution_opportunities,
    }


@router.get("/opportunities")
async def get_opportunities(db: Session = Depends(get_db)):
    """Return aggregated OSS contribution opportunities from recent sessions."""
    from app.services.recall_service import get_all_sessions

    sessions = get_all_sessions(db, skip=0, limit=10)
    all_opps: list = []
    seen_urls: set = set()
    keywords: list[str] = []

    for s in sessions:
        if s.terminal_output:
            kw = extract_error_keyword(s.terminal_output)
            if kw and kw not in keywords:
                keywords.append(kw)
        if len(keywords) >= 3:
            break

    for kw in keywords:
        for opp in await search_github_contributions(kw):
            if opp["html_url"] not in seen_urls:
                seen_urls.add(opp["html_url"])
                all_opps.append(opp)

    return {"opportunities": all_opps[:20]}
