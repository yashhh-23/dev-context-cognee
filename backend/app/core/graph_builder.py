"""Build a frontend-ready graph payload from SessionRecord rows."""
from __future__ import annotations
from typing import List, Dict, Any
from app.models.session import SessionRecord
import re


# ── node / edge types matching PRD colours ──────────────────────────────────
NODE_COLORS = {
    "project":      "#58a6ff",
    "bug":         "#f85149",
    "dependency":  "#d29922",
    "fix":         "#3fb950",
    "github_issue": "#bc8cff",
}


def _dep_from_text(text: str) -> List[str]:
    """Best-effort dependency name extraction."""
    patterns = [
        r"(?:import|require|from)\s+([\w\-\.]+)",
        r"([\w\-]+)==[\d\.]+",
        r"\"([\w\-\.]+)\":\s*\"[\^~][\d\.]+\"",
    ]
    found: set = set()
    for p in patterns:
        for m in re.findall(p, text or ""):
            if 2 < len(m) < 40:
                found.add(m)
    return list(found)[:5]


def _is_error(text: str) -> bool:
    keywords = ["error", "exception", "failed", "traceback", "fatal", "cannot", "undefined"]
    t = (text or "").lower()
    return any(k in t for k in keywords)


def build_graph(sessions: List[SessionRecord]) -> Dict[str, Any]:
    nodes: List[Dict] = []
    edges: List[Dict] = []
    node_ids: set = set()

    def add_node(nid: str, ntype: str, label: str, data: dict = None):
        if nid not in node_ids:
            node_ids.add(nid)
            nodes.append({
                "id": nid,
                "type": ntype,
                "label": label[:40],
                "color": NODE_COLORS.get(ntype, "#8b949e"),
                "data": data or {},
            })

    def add_edge(src: str, tgt: str, label: str):
        edges.append({"source": src, "target": tgt, "label": label})

    for s in sessions:
        # Project node
        proj_id = f"project:{s.project}"
        add_node(proj_id, "project", s.project, {"project": s.project})

        # Session/bug node
        is_bug = _is_error(s.terminal_output or "")
        node_type = "bug" if is_bug else "fix"
        sess_id = f"session:{s.id}"
        short = (s.terminal_output or "")[:60].strip().replace("\n", " ")
        add_node(sess_id, node_type, short or s.id[:8], {
            "session_id": s.id,
            "status": s.status,
            "branch": s.branch,
            "timestamp": s.timestamp.isoformat() if s.timestamp else None,
        })
        add_edge(proj_id, sess_id, "belongs_to")

        # Dependency nodes
        for dep in _dep_from_text(s.terminal_output):
            dep_id = f"dep:{dep}"
            add_node(dep_id, "dependency", dep, {"name": dep})
            add_edge(sess_id, dep_id, "uses")

        # Fix node if resolved
        if s.status == "completed" and is_bug:
            fix_id = f"fix:{s.id}"
            add_node(fix_id, "fix", f"fix:{short[:30]}", {"session_id": s.id})
            add_edge(sess_id, fix_id, "fixed_by")

    return {"nodes": nodes, "edges": edges}
