"""GET /stats — dashboard overview KPIs. GET /bug-trend — 7-day real GitHub trend."""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.services.recall_service import get_all_sessions
from app.core.graph_builder import build_graph
import datetime
import httpx
import os

from app.core.config import settings

router = APIRouter()


async def _get_open_bug_count() -> int:
    """Fetch real open issue count from GitHub."""
    repo = settings.GITHUB_REPO or ""
    if not repo:
        return 0
    headers = {"Accept": "application/vnd.github+json"}
    token = settings.GITHUB_TOKEN or ""
    if token:
        headers["Authorization"] = f"Bearer {token}"
    try:
        async with httpx.AsyncClient(timeout=8) as client:
            resp = await client.get(
                f"https://api.github.com/repos/{repo}",
                headers=headers,
            )
        if resp.status_code == 200:
            return resp.json().get("open_issues_count", 0)
        else:
            return -1
    except Exception:
        pass
    return -1


@router.get("/stats")
async def get_stats(db: Session = Depends(get_db)):
    sessions   = get_all_sessions(db, skip=0, limit=500)
    total      = len(sessions)
    open_bugs  = await _get_open_bug_count()

    # Real memory node count from Cognee graph builder
    graph_data   = build_graph(sessions)
    memory_nodes = len(graph_data.get("nodes", []))

    # Count sessions completed today as a proxy for recalled_today
    today = datetime.datetime.utcnow().date()
    recalled_today = sum(
        1 for s in sessions
        if s.timestamp and s.timestamp.date() == today and s.status == "completed"
    )

    health = max(0, 100 - open_bugs * 2)

    last_session = ""
    if sessions:
        try:
            # sessions are ordered desc, so index 0 is the most recent
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
    """Return last 7 days opened/closed issue counts via 2 batched GitHub Search queries."""
    repo = settings.GITHUB_REPO or ""
    if not repo:
        return {"labels": [], "opened": [], "closed": []}

    headers = {"Accept": "application/vnd.github+json"}
    token = settings.GITHUB_TOKEN or ""
    if token:
        headers["Authorization"] = f"Bearer {token}"

    today      = datetime.date.today()
    days       = [(today - datetime.timedelta(days=i)) for i in range(6, -1, -1)]
    day_strs   = [d.strftime("%Y-%m-%d") for d in days]
    day_names  = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
    start_date = day_strs[0]
    end_date   = day_strs[-1]

    opened_map: dict[str, int] = {d: 0 for d in day_strs}
    closed_map: dict[str, int] = {d: 0 for d in day_strs}

    async with httpx.AsyncClient(timeout=20) as client:
        # Single query for all opened issues in the 7-day range
        r_opened = await client.get(
            "https://api.github.com/search/issues",
            params={
                "q": f"repo:{repo} is:issue created:{start_date}..{end_date}",
                "per_page": 100,
                "sort": "created",
                "order": "asc",
            },
            headers=headers,
        )
        if r_opened.status_code == 200:
            for item in r_opened.json().get("items", []):
                created_date = item["created_at"][:10]
                if created_date in opened_map:
                    opened_map[created_date] += 1

        # Single query for all closed issues in the 7-day range
        r_closed = await client.get(
            "https://api.github.com/search/issues",
            params={
                "q": f"repo:{repo} is:issue closed:{start_date}..{end_date}",
                "per_page": 100,
                "sort": "updated",
                "order": "asc",
            },
            headers=headers,
        )
        if r_closed.status_code == 200:
            for item in r_closed.json().get("items", []):
                closed_date = (item.get("closed_at") or "")[:10]
                if closed_date in closed_map:
                    closed_map[closed_date] += 1

    labels        = [day_names[d.weekday()] for d in days]
    opened_counts = [opened_map[d] for d in day_strs]
    closed_counts = [closed_map[d] for d in day_strs]

    return {"labels": labels, "opened": opened_counts, "closed": closed_counts}
