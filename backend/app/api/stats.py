"""GET /stats — dashboard overview KPIs. GET /bug-trend — 7-day real GitHub trend."""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.services.recall_service import get_all_sessions
from app.core.graph_builder import build_graph
from app.models.session import SessionRecord
from collections import Counter
import datetime
import httpx
import os

router = APIRouter()

GITHUB_TOKEN = os.getenv("GITHUB_TOKEN", "")
GITHUB_REPO  = os.getenv("GITHUB_REPO", "")


async def _get_open_bug_count() -> int:
    """Fetch real open issue count from GitHub."""
    if not GITHUB_REPO:
        return 0
    headers = {"Accept": "application/vnd.github+json"}
    if GITHUB_TOKEN:
        headers["Authorization"] = f"Bearer {GITHUB_TOKEN}"
    try:
        async with httpx.AsyncClient(timeout=8) as client:
            resp = await client.get(
                f"https://api.github.com/repos/{GITHUB_REPO}",
                headers=headers,
            )
        if resp.status_code == 200:
            return resp.json().get("open_issues_count", 0)
    except Exception:
        pass
    return 0


@router.get("/stats")
async def get_stats(db: Session = Depends(get_db)):
    sessions = get_all_sessions(db, skip=0, limit=500)
    total    = len(sessions)

    open_bugs = await _get_open_bug_count()
    health = max(0, 100 - open_bugs * 2)

    try:
        graph_data = build_graph(sessions)
        memory_nodes = len(graph_data.get("nodes", []))
    except Exception:
        memory_nodes = total

    today_start = datetime.datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
    recalled_today = db.query(SessionRecord).filter(
        SessionRecord.timestamp >= today_start
    ).count()

    last_session = ""
    if sessions:
        try:
            last_session = sessions[0].timestamp.isoformat()
        except Exception:
            last_session = ""

    return {
        "total_sessions":  total,
        "open_bugs":       open_bugs,
        "memory_nodes":    memory_nodes,
        "recalled_today":  recalled_today,
        "last_session":    last_session,
        "health_score":    health,
    }


@router.get("/bug-trend")
async def bug_trend():
    """Return last 7 days opened/closed issue counts from GitHub Search API."""
    if not GITHUB_REPO:
        return {"labels": [], "opened": [], "closed": []}

    headers = {"Accept": "application/vnd.github+json"}
    if GITHUB_TOKEN:
        headers["Authorization"] = f"Bearer {GITHUB_TOKEN}"

    today = datetime.date.today()
    days  = [(today - datetime.timedelta(days=i)).strftime("%Y-%m-%d") for i in range(6, -1, -1)]
    day_names = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"]

    opened_counts: list[int] = []
    closed_counts: list[int] = []

    async with httpx.AsyncClient(timeout=20) as client:
        for day in days:
            r1 = await client.get(
                "https://api.github.com/search/issues",
                params={"q": f"repo:{GITHUB_REPO} is:issue created:{day}", "per_page": 1},
                headers=headers,
            )
            opened_counts.append(r1.json().get("total_count", 0) if r1.status_code == 200 else 0)

            r2 = await client.get(
                "https://api.github.com/search/issues",
                params={"q": f"repo:{GITHUB_REPO} is:issue closed:{day}", "per_page": 1},
                headers=headers,
            )
            closed_counts.append(r2.json().get("total_count", 0) if r2.status_code == 200 else 0)

    labels = [day_names[datetime.datetime.strptime(d, "%Y-%m-%d").weekday()] for d in days]
    return {"labels": labels, "opened": opened_counts, "closed": closed_counts}
