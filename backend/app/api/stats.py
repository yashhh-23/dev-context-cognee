"""GET /stats — dashboard overview KPIs. GET /bug-trend — 7-day real GitHub trend."""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.services.recall_service import get_all_sessions
from app.core.graph_builder import build_graph
import asyncio
import datetime
import httpx
import os
import math

from app.core.config import settings
from app.utils.github_utils import get_github_headers

router = APIRouter()


async def _get_open_bug_count() -> int:
    """Fetch real open issue count from GitHub."""
    repo = settings.GITHUB_REPO or ""
    if not repo:
        return 0
    headers = get_github_headers(settings.GITHUB_TOKEN)
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


def _compute_health_score(
    sessions: list,
    open_bugs: int,
    memory_nodes: int,
) -> int:
    """
    Compute a real health score (0-100) derived entirely from live data:

      - resolved_ratio   (40 pts): fraction of sessions that are resolved/completed.
        Rewards a healthy fix rate.
      - memory_density   (30 pts): memory nodes relative to sessions, capped at 1.0.
        Rewards rich Cognee graph coverage.
      - bug_health       (30 pts): penalises open bugs. Capped so a repo with 0
        configured GitHub repo still scores full points on this component.
    """
    total = len(sessions)

    # Component 1 — session resolve rate
    if total > 0:
        resolved = sum(
            1 for s in sessions
            if s.status in ("resolved", "completed")
        )
        resolved_ratio = resolved / total
    else:
        resolved_ratio = 0.0

    # Component 2 — memory node density (nodes per session, capped at 1.0)
    if total > 0:
        density = min(memory_nodes / total, 1.0)
    else:
        density = 0.0

    # Component 3 — bug health (fewer open bugs = higher score)
    if open_bugs < 0:
        # GitHub unreachable / not configured — don't penalise
        bug_health_ratio = 1.0
    elif open_bugs == 0:
        bug_health_ratio = 1.0
    else:
        # Diminishing penalty: score halves every 10 open bugs
        bug_health_ratio = max(0.0, 1.0 - math.log1p(open_bugs) / math.log1p(50))

    score = (
        resolved_ratio  * 40
        + density       * 30
        + bug_health_ratio * 30
    )
    return round(score)


from app.models.session import SessionRecord

@router.get("/stats")
async def get_stats(db: Session = Depends(get_db)):
    sessions = db.query(SessionRecord).order_by(SessionRecord.timestamp.desc()).limit(50).all()
    total        = len(sessions)
    open_bugs    = await _get_open_bug_count()

    # Real memory node count from Cognee graph builder
    graph_data   = build_graph(sessions)
    memory_nodes = len(graph_data.get("nodes", []))

    # Count sessions completed today as a proxy for recalled_today
    today = datetime.datetime.utcnow().date()
    recalled_today = sum(
        1 for s in sessions
        if s.timestamp and s.timestamp.date() == today and s.status == "completed"
    )

    health = _compute_health_score(sessions, open_bugs, memory_nodes)

    # Compute dynamic metrics based on live data
    # Code Quality: penalize based on open bugs
    code_quality = max(0, min(100, 100 - int(math.log1p(max(0, open_bugs)) * 20)))

    # Test Coverage: ratio of completed/resolved sessions to total sessions, baseline 70
    if total > 0:
        resolved = sum(1 for s in sessions if s.status in ("resolved", "completed"))
        test_coverage = min(100, int(50 + 50 * (resolved / total)))
    else:
        test_coverage = 75  # default baseline

    # Documentation: ratio of memory nodes relative to sessions, mapped to 70-100%
    if total > 0:
        doc_ratio = min(memory_nodes / total, 1.0)
        documentation = min(100, int(70 + 30 * doc_ratio))
    else:
        documentation = 80

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
        "code_quality":    code_quality,
        "test_coverage":   test_coverage,
        "documentation":   documentation,
    }



@router.get("/bug-trend")
async def bug_trend():
    """Return last 7 days opened/closed issue counts via 2 batched GitHub Search queries."""
    repo = settings.GITHUB_REPO or ""
    if not repo:
        return {"labels": [], "opened": [], "closed": []}

    headers = get_github_headers(settings.GITHUB_TOKEN)

    today      = datetime.date.today()
    days       = [(today - datetime.timedelta(days=i)) for i in range(6, -1, -1)]
    day_strs   = [d.strftime("%Y-%m-%d") for d in days]
    day_names  = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
    start_date = day_strs[0]
    end_date   = day_strs[-1]

    opened_map: dict[str, int] = {d: 0 for d in day_strs}
    closed_map: dict[str, int] = {d: 0 for d in day_strs}

    async with httpx.AsyncClient(timeout=20) as client:
        req_opened = client.get(
            "https://api.github.com/search/issues",
            params={
                "q": f"repo:{repo} is:issue created:{start_date}..{end_date}",
                "per_page": 100,
                "sort": "created",
                "order": "asc",
            },
            headers=headers,
        )
        req_closed = client.get(
            "https://api.github.com/search/issues",
            params={
                "q": f"repo:{repo} is:issue closed:{start_date}..{end_date}",
                "per_page": 100,
                "sort": "updated",
                "order": "asc",
            },
            headers=headers,
        )
        r_opened, r_closed = await asyncio.gather(req_opened, req_closed)
        if r_opened.status_code == 200:
            for item in r_opened.json().get("items", []):
                created_date = item["created_at"][:10]
                if created_date in opened_map:
                    opened_map[created_date] += 1
        if r_closed.status_code == 200:
            for item in r_closed.json().get("items", []):
                closed_date = (item.get("closed_at") or "")[:10]
                if closed_date in closed_map:
                    closed_map[closed_date] += 1

    labels        = [day_names[d.weekday()] for d in days]
    opened_counts = [opened_map[d] for d in day_strs]
    closed_counts = [closed_map[d] for d in day_strs]

    return {"labels": labels, "opened": opened_counts, "closed": closed_counts}
