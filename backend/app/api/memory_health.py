"""
GET /api/stats/memory-health
Returns Cognee memory graph stats: node count, pinned, decaying, topic distribution, health score.
"""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.services.recall_service import get_all_sessions
from app.core.graph_builder import build_graph
from cognee.infrastructure.databases.graph import get_graph_engine
import importlib.metadata
import datetime
from dateutil.parser import isoparse
import traceback

router = APIRouter()


@router.get("/memory-health")
async def memory_health(db: Session = Depends(get_db)):
    nodes = []
    graph_nodes_count = 0
    graph_edges_count = 0
    
    try:
        graph_engine = await get_graph_engine()
        data = await graph_engine.get_graph_data()
        
        if data and len(data) >= 2 and data[0]:
            cognee_nodes, cognee_edges = data
            node_ids = set()
            for node in cognee_nodes:
                nid = str(node[0])
                props = node[1]
                if nid not in node_ids:
                    node_ids.add(nid)
                    nodes.append(props)
            
            graph_nodes_count = len(node_ids)
            graph_edges_count = len(cognee_edges)
        else:
            # Fallback
            sessions = get_all_sessions(db, skip=0, limit=2000)
            graph_data = build_graph(sessions)
            nodes = graph_data.get("nodes", [])
            graph_nodes_count = len(nodes)
            graph_edges_count = len(graph_data.get("edges", []))
    except Exception as e:
        traceback.print_exc()
        sessions = get_all_sessions(db, skip=0, limit=2000)
        graph_data = build_graph(sessions)
        nodes = graph_data.get("nodes", [])
        graph_nodes_count = len(nodes)
        graph_edges_count = len(graph_data.get("edges", []))

    total_nodes = len(nodes)

    # Pinned: nodes that have a `pinned` flag truthy
    pinned_nodes = sum(1 for n in nodes if n.get("pinned"))

    # Decaying: nodes older than 7 days with no recent recall
    cutoff = datetime.datetime.now(datetime.timezone.utc).replace(tzinfo=None) - datetime.timedelta(days=7)
    decaying_nodes = 0
    for n in nodes:
        ts_raw = n.get("timestamp") or n.get("created_at") or ""
        if ts_raw:
            try:
                ts = isoparse(str(ts_raw)).replace(tzinfo=None)
                if ts < cutoff:
                    decaying_nodes += 1
            except Exception:
                pass

    # Topic distribution from node labels / types
    topic_map: dict[str, int] = {}
    for n in nodes:
        label = str(n.get("label") or n.get("type") or n.get("group") or "unknown")
        topic_map[label] = topic_map.get(label, 0) + 1
    # Sort descending, cap at 8 topics for display
    topics = sorted(
        [{"name": k, "count": v} for k, v in topic_map.items()],
        key=lambda x: x["count"],
        reverse=True,
    )[:8]

    # health_score: 100 - decay_ratio * 40 - (nodes==0 penalty)
    if total_nodes == 0:
        health_score = 0
    else:
        decay_ratio = decaying_nodes / total_nodes
        health_score = max(0, round(100 - decay_ratio * 40))
        if total_nodes < 5:
            health_score = max(0, health_score - 20)

    # Cognee version
    try:
        cognee_version = importlib.metadata.version("cognee")
    except Exception:
        cognee_version = "unknown"

    return {
        "total_nodes": total_nodes,
        "pinned_nodes": pinned_nodes,
        "decaying_nodes": decaying_nodes,
        "topics": topics,
        "health_score": health_score,
        "cognee_version": cognee_version,
        # Fields expected by the frontend GraphClient component
        "total_memories": graph_nodes_count,
        "graph_nodes": graph_nodes_count,
        "graph_edges": graph_edges_count,
        "last_updated": datetime.datetime.now(datetime.timezone.utc).isoformat().replace("+00:00", "Z")
    }


@router.get("")
def api_stats():
    return {"status": "ok", "total_datasets": 1, "cognee_ready": True}
