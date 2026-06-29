"""GET /stats — dashboard overview KPIs."""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.services.recall_service import get_all_sessions
from app.models.session import SessionRecord
from collections import Counter
import datetime

router = APIRouter()


@router.get("/stats")
def get_stats(db: Session = Depends(get_db)):
    sessions = get_all_sessions(db, skip=0, limit=500)
    total = len(sessions)
    completed = sum(1 for s in sessions if s.status == "completed")
    failed    = sum(1 for s in sessions if s.status == "failed")
    projects  = list({s.project for s in sessions if s.project})

    # Bug frequency per day (last 7 days)
    today = datetime.date.today()
    day_counts: Counter = Counter()
    for s in sessions:
        if s.timestamp:
            delta = (today - s.timestamp.date()).days
            if 0 <= delta < 7:
                label = s.timestamp.strftime("%a")
                day_counts[label] += 1

    bug_frequency = [
        {"day": (today - datetime.timedelta(days=i)).strftime("%a"),
         "count": day_counts.get(
             (today - datetime.timedelta(days=i)).strftime("%a"), 0)}
        for i in range(6, -1, -1)
    ]

    open_bugs_count = 0
    import os, httpx
    repo = os.getenv("GITHUB_REPO", "")
    token = os.getenv("GITHUB_TOKEN", "")
    if repo:
        try:
            with httpx.Client(timeout=3) as client:
                headers = {"Accept": "application/vnd.github+json"}
                if token: headers["Authorization"] = f"Bearer {token}"
                resp = client.get(f"https://api.github.com/repos/{repo}", headers=headers)
                if resp.status_code == 200:
                    open_bugs_count = resp.json().get("open_issues_count", 0)
        except Exception:
            pass

    return {
        "total_sessions": total,
        "completed": completed,
        "failed": failed,
        "projects": projects,
        "bug_frequency": bug_frequency,
        "open_bugs":      open_bugs_count,
        "memory_nodes":   total,           # using total sessions as proxy
        "recalled_today": 0,
        "last_session":   sessions[-1].timestamp.isoformat() if sessions else "",
        "health_score":   98,              # mock health score
    }
