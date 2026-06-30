"""Memories API — auto-clean: deduplicate and prune stale Cognee memory nodes."""
import difflib
import asyncio
from fastapi import APIRouter
import cognee
from app.services.recall_service import extract_text

router = APIRouter()


@router.post("/auto-clean")
async def auto_clean():
    """
    Scan all recalled memories, find near-duplicate clusters (similarity >= 0.93),
    keep the longest/most-informative one per cluster, forget the rest.
    Returns a summary: { removed: int, kept: int, clusters: int }
    Safety: never removes a node if Cognee recall returns nothing.
    """
    try:
        # Pull a broad set of memories using common anchor queries
        anchor_queries = [
            "project context", "bug fix", "session", "error", "code", "memory"
        ]
        seen_texts: dict[str, str] = {}  # text -> node_id

        async def fetch(q: str):
            try:
                return await cognee.recall(q)
            except Exception:
                return []

        raw_batches = await asyncio.gather(*(fetch(q) for q in anchor_queries))

        # Flatten and deduplicate by node id
        all_items: list[dict] = []
        seen_ids: set[str] = set()
        for batch in raw_batches:
            items = batch if isinstance(batch, list) else [batch]
            for item in items:
                text = extract_text(item)
                if not text:
                    continue
                # Build a stable id from text hash since Cognee nodes may lack ids
                node_id = str(getattr(item, "id", None) or
                              (item.get("id") if isinstance(item, dict) else None) or
                              str(abs(hash(text)) % (10 ** 12)))
                if node_id not in seen_ids:
                    seen_ids.add(node_id)
                    all_items.append({"id": node_id, "text": text})

        if len(all_items) < 2:
            return {"removed": 0, "kept": len(all_items), "clusters": 0}

        # Cluster near-duplicates (similarity >= 0.93)
        DUP_THRESHOLD = 0.93
        clusters: list[list[dict]] = []
        assigned = [False] * len(all_items)

        for i, item in enumerate(all_items):
            if assigned[i]:
                continue
            cluster = [item]
            assigned[i] = True
            for j in range(i + 1, len(all_items)):
                if assigned[j]:
                    continue
                sim = difflib.SequenceMatcher(
                    None,
                    item["text"].strip().lower(),
                    all_items[j]["text"].strip().lower(),
                ).ratio()
                if sim >= DUP_THRESHOLD:
                    cluster.append(all_items[j])
                    assigned[j] = True
            clusters.append(cluster)

        # For each cluster keep the longest text, forget the rest
        removed = 0
        dup_clusters = [c for c in clusters if len(c) > 1]

        async def forget_node(node_id: str):
            try:
                await cognee.forget(node_id)
                return True
            except Exception:
                return False

        forget_tasks = []
        for cluster in dup_clusters:
            # keep the node with the longest text (most informative)
            best = max(cluster, key=lambda x: len(x["text"]))
            to_remove = [n for n in cluster if n["id"] != best["id"]]
            for node in to_remove:
                forget_tasks.append(forget_node(node["id"]))

        results = await asyncio.gather(*forget_tasks)
        removed = sum(1 for r in results if r)

        return {
            "removed": removed,
            "kept": len(all_items) - removed,
            "clusters": len(dup_clusters),
        }

    except Exception as e:
        return {"removed": 0, "kept": 0, "clusters": 0, "error": str(e)}
