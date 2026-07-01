"""GET /graph — return memory graph nodes + edges for visualisation."""
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.graph_builder import build_graph
from app.services.recall_service import get_all_sessions

router = APIRouter()


@router.get("")
def get_graph(project: str = Query(None, description="Filter by project name"),
             db: Session = Depends(get_db)):
    """Return force-graph compatible nodes and edges."""
    sessions = get_all_sessions(db, skip=0, limit=200)
    if project:
        sessions = [s for s in sessions if s.project == project]
    return build_graph(sessions)

@router.post("/build")
def trigger_build_graph(project: str = Query(None, description="Filter by project name"),
                        db: Session = Depends(get_db)):
    """Trigger a graph rebuild (returns stats)."""
    sessions = get_all_sessions(db, skip=0, limit=200)
    if project:
        sessions = [s for s in sessions if s.project == project]
    graph_data = build_graph(sessions)
    return {"message": "Graph rebuilt successfully", "node_count": len(graph_data.get("nodes", []))}
