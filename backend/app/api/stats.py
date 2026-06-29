"""GET /stats — dashboard overview KPIs."""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.services.recall_service import get_all_sessions
from app.models.session import SessionRecord
from collections import Counter
import datetime

router = APIRouter()


@router.get("/")
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

    return {
        "total_sessions": total,
        "completed": completed,
        "failed": failed,
        "projects": projects,
        "bug_frequency": bug_frequency,
    }
