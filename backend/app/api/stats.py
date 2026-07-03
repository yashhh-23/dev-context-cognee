"""GET /stats — dashboard overview KPIs. GET /bug-trend — 7-day real GitHub trend."""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.services.recall_service import get_all_sessions
from app.core.graph_builder import build_graph
import asyncio
import datetime
import httpx
import math
import time

from app.core.config import settings
from app.utils.github_utils import get_github_headers

from app.api.bugs import get_all_issues

router = APIRouter()


async def _get_open_bug_count() -> int:
    """Fetch real open issue count from GitHub (excluding pull requests)."""
    repo = settings.GITHUB_REPO or ""
    if not repo:
        return 0
    headers = get_github_headers(settings.GITHUB_TOKEN)
    try:
        issues = await get_all_issues(repo, headers)
        return len(issues)
    except Exception as e:
        print(f"[stats] error fetching open issue count from {repo}: {e}")
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
            if s.status in ("resolved", "completed", "improved_memory")
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
    today = datetime.datetime.now(datetime.timezone.utc).date()
    recalled_today = sum(
        1 for s in sessions
        if s.timestamp and s.timestamp.date() == today and s.status == "completed"
    )

    health = _compute_health_score(sessions, open_bugs, memory_nodes)

    # Compute dynamic metrics based on live data
    # Code Quality: penalize based on open bugs (less harsh penalty)
    code_quality = max(0, min(100, 100 - int(math.log1p(max(0, open_bugs)) * 5)))

    # Test Coverage: ratio of completed/resolved sessions to total sessions, baseline 70
    if total > 0:
        resolved = sum(1 for s in sessions if s.status in ("resolved", "completed", "improved_memory"))
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



_trend_cache = {}
_TREND_CACHE_TTL = 60

@router.get("/bug-trend")
async def bug_trend():
    """Return last 7 days opened/closed issue counts efficiently via cached repository API."""
    now = time.time()
    repo = settings.GITHUB_REPO or ""
    if not repo:
        return {"labels": [], "opened": [], "closed": []}

    if repo in _trend_cache:
        cached_time, cached_data = _trend_cache[repo]
        if now - cached_time < _TREND_CACHE_TTL:
            return cached_data

    headers = get_github_headers(settings.GITHUB_TOKEN)

    today      = datetime.date.today()
    days       = [(today - datetime.timedelta(days=i)) for i in range(6, -1, -1)]
    day_strs   = [d.strftime("%Y-%m-%d") for d in days]
    day_names  = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
    start_date = day_strs[0]
    start_time_iso = f"{start_date}T00:00:00Z"

    opened_map: dict[str, int] = {d: 0 for d in day_strs}
    closed_map: dict[str, int] = {d: 0 for d in day_strs}

    issues = []
    async with httpx.AsyncClient(timeout=10) as client:
        page = 1
        while page <= 5:  # up to 500 issues in a week
            resp = await client.get(
                f"https://api.github.com/repos/{repo}/issues",
                params={
                    "state": "all",
                    "since": start_time_iso,
                    "per_page": 100,
                    "page": page
                },
                headers=headers,
            )
            if resp.status_code == 200:
                raw_items = resp.json()
                page_items = [item for item in raw_items if "pull_request" not in item]
                issues.extend(page_items)
                if len(raw_items) < 100:
                    break
            else:
                print(f"[stats] bug-trend API error: {resp.status_code} - {resp.text}")
                break
            page += 1

    for item in issues:
        created_date = item.get("created_at", "")[:10]
        if created_date in opened_map:
            opened_map[created_date] += 1
        
        closed_at = item.get("closed_at")
        if closed_at:
            closed_date = closed_at[:10]
            if closed_date in closed_map:
                closed_map[closed_date] += 1

    labels        = [day_names[d.weekday()] for d in days]
    opened_counts = [opened_map[d] for d in day_strs]
    closed_counts = [closed_map[d] for d in day_strs]

    result = {"labels": labels, "opened": opened_counts, "closed": closed_counts}
    _trend_cache[repo] = (now, result)
    return result
