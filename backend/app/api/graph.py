"""GET /graph — return memory graph nodes + edges for visualisation."""
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.graph_builder import build_graph, NODE_COLORS
from app.services.recall_service import get_all_sessions
from app.models.session import MemoryFeedback
from cognee.infrastructure.databases.graph import get_graph_engine
import traceback

router = APIRouter()


@router.get("")
async def get_graph(project: str = Query(None, description="Filter by project name"),
                    db: Session = Depends(get_db)):
    """Return force-graph compatible nodes and edges from Cognee, enriched with feedback details."""
    try:
        graph_engine = await get_graph_engine()
        data = await graph_engine.get_graph_data()
        
        if not data or len(data) < 2 or not data[0]:
            # If Cognee graph is empty, fall back to relational DB sessions graph
            sessions = get_all_sessions(db, skip=0, limit=200)
            if project:
                sessions = [s for s in sessions if s.project == project]
            return build_graph(sessions)
            
        cognee_nodes, cognee_edges = data
        
        # Load feedback data from SQLite to enrich nodes
        feedback_list = db.query(MemoryFeedback).all()
        feedback_map = {f.node_id: f for f in feedback_list}
        
        nodes = []
        edges = []
        node_ids = set()
        
        for node in cognee_nodes:
            nid = str(node[0])
            props = node[1]
            if nid not in node_ids:
                node_ids.add(nid)
                ntype = props.get("type") or props.get("node_type") or "concept"
                
                # Map to UI types
                mapped_type = "project"
                ntype_lower = ntype.lower()
                if "bug" in ntype_lower or "error" in ntype_lower:
                    mapped_type = "bug"
                elif "dependency" in ntype_lower or "package" in ntype_lower:
                    mapped_type = "dependency"
                elif "fix" in ntype_lower or "resolve" in ntype_lower:
                    mapped_type = "fix"
                elif "issue" in ntype_lower:
                    mapped_type = "github_issue"
                else:
                    mapped_type = "project"
                    
                label = props.get("name") or props.get("text") or props.get("label") or nid
                if len(label) > 100:
                    label = label[:97] + "..."
                    
                # Look up feedback for enrichment
                fb = feedback_map.get(nid)
                thumbs = fb.thumbs if fb else ""
                confidence = fb.confidence_score if fb else 100
                decay = "decaying" if (fb and fb.thumbs == "down") else "active"
                
                nodes.append({
                    "id": nid,
                    "type": mapped_type,
                    "label": label,
                    "color": NODE_COLORS.get(mapped_type, "#8b949e"),
                    "data": {
                        **props,
                        "created_at": props.get("created_at") or props.get("updated_at") or None,
                        "access_count": props.get("access_count") or props.get("recall_count") or 1,
                        "decay_status": decay,
                        "confidence_score": confidence,
                        "thumbs": thumbs,
                    }
                })
                
        for edge in cognee_edges:
            src = str(edge[0])
            tgt = str(edge[1])
            rel = edge[2]
            props = edge[3] if len(edge) > 3 else {}
            edges.append({
                "source": src,
                "target": tgt,
                "label": rel,
                "weight": props.get("weight") or props.get("feedback_weight") or 1.0
            })
            
        return {"nodes": nodes, "edges": edges}
        
    except Exception as e:
        traceback.print_exc()
        print(f"[get_graph] Failed to fetch Cognee graph, falling back: {e}")
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
