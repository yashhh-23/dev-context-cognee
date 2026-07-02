"""recall_service.py — Hybrid Graph-Vector memory retrieval layer.

Strategy
--------
Two independent retrieval channels are fired concurrently via asyncio.gather():

  • CHUNKS           — dense vector similarity search over embedded text segments.
  • GRAPH_COMPLETION — traverses relationship topology and returns raw structural
                       context facts (only_context=True bypasses LLM generation
                       latency and pulls the graph facts directly).

Results are merged and deduplicated on item `id` (falling back to text signature
when no `id` is present), then returned as a unified list ready for the caller's
ranking / conflict-detection pipeline.

Graceful degradation: if the graph or vector stores are empty / unavailable, the
implementation falls back to the high-level `cognee.recall()` router so the API
never returns a hard error to the user.
"""

import asyncio
import hashlib
import re
from typing import Any

import cognee
from cognee import SearchType           # re-exported at package root (cognee 1.2.1+)
from sqlalchemy.orm import Session

from app.models.session import SessionRecord


# ─── Session helpers ──────────────────────────────────────────────────────────

def get_all_sessions(db: Session, skip: int = 0, limit: int = 100):
    return (
        db.query(SessionRecord)
        .order_by(SessionRecord.timestamp.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )


def get_session(db: Session, session_id: str):
    return db.query(SessionRecord).filter(SessionRecord.id == session_id).first()


# ─── Text extraction helper ───────────────────────────────────────────────────

def extract_text(item: Any) -> str:
    """Safely extract human-readable text from any Cognee search result type.

    Cognee 1.x can return:
      • SearchResult dataclasses  (kind='temporal' search_type='CHUNKS' text="…")
      • plain dicts               ({"id": …, "text": …})
      • raw strings               (from GRAPH_COMPLETION with only_context=True)
    """
    if item is None:
        return ""

    # Plain string (e.g. GRAPH_COMPLETION context blob)
    if isinstance(item, str):
        return item.strip()

    # Dict-style result
    if isinstance(item, dict):
        return (
            item.get("text")
            or item.get("content")
            or item.get("value")
            or str(item)
        )

    # Cognee SearchResult / dataclass — probe known text attributes in priority order
    for attr in ("text", "content", "value", "description"):
        val = getattr(item, attr, None)
        if val and isinstance(val, str) and val.strip():
            return val.strip()

    # Last resort: stringify and strip dataclass repr noise
    raw = str(item)
    match = re.search(r"text=['\"](.+?)['\"](\s|$|,)", raw, re.DOTALL)
    if match:
        return match.group(1).strip()
    match = re.search(r"content=['\"](.+?)['\"](\s|$|,)", raw, re.DOTALL)
    if match:
        return match.group(1).strip()

    return raw


# ─── Normalisation helpers ────────────────────────────────────────────────────

def _normalise_to_list(raw: Any) -> list[Any]:
    """Always return a list regardless of what cognee.search() emitted."""
    if raw is None:
        return []
    if isinstance(raw, list):
        return raw
    return [raw]


def _normalise_graph_item(item: Any) -> dict:
    """Wrap a GRAPH_COMPLETION result into a canonical dict so that extract_text()
    and parse_item() downstream handle it uniformly.

    GRAPH_COMPLETION with only_context=True can return:
      • a plain string — the raw context paragraph
      • a dict         — already normalised
      • a dataclass    — extract via attribute access
    """
    if isinstance(item, str):
        # Stable id derived from content so dedup works correctly across runs
        sig = hashlib.sha256(item.encode()).hexdigest()[:16]
        return {"id": f"graph-context-{sig}", "text": item, "source": "graph"}

    if isinstance(item, dict):
        item.setdefault("source", "graph")
        return item

    # Dataclass / SearchResult object — convert to dict
    node_id = getattr(item, "id", None) or getattr(item, "node_id", None)
    text = extract_text(item)
    return {
        "id": str(node_id) if node_id else f"graph-context-{hashlib.sha256(text.encode()).hexdigest()[:16]}",
        "text": text,
        "source": "graph",
    }


def _normalise_chunk_item(item: Any) -> dict:
    """Wrap a CHUNKS result into a canonical dict.

    CHUNKS returns segment dicts with 'id' and 'text' (Cognee 1.x).
    """
    if isinstance(item, dict):
        item.setdefault("source", "vector")
        return item

    node_id = getattr(item, "id", None) or getattr(item, "node_id", None)
    text = extract_text(item)
    return {
        "id": str(node_id) if node_id else f"chunk-{hashlib.sha256(text.encode()).hexdigest()[:16]}",
        "text": text,
        "source": "vector",
    }


def _dedup(items: list[dict]) -> list[dict]:
    """Deduplicate on canonical id first; fall back to text-signature for items
    that share the same content but have different auto-generated ids."""
    seen_ids: set[str] = set()
    seen_text_sigs: set[str] = set()
    out: list[dict] = []

    for item in items:
        item_id = str(item.get("id") or "")
        text = extract_text(item)
        text_sig = hashlib.sha256(text.strip().lower().encode()).hexdigest()

        if item_id and item_id in seen_ids:
            continue
        if text_sig in seen_text_sigs:
            continue

        if item_id:
            seen_ids.add(item_id)
        seen_text_sigs.add(text_sig)
        out.append(item)

    return out


# ─── Core hybrid search function ──────────────────────────────────────────────

async def search_memory(query: str) -> list[Any]:
    """Hybrid graph-vector recall — merges CHUNKS + GRAPH_COMPLETION results.

    Execution model
    ───────────────
    1. asyncio.gather() fires both channels concurrently (no serial latency).
    2. Each channel's results are normalised into canonical dicts.
    3. The two lists are merged and deduplicated.
    4. If both channels fail or return empty, falls back to cognee.recall().

    Args:
        query: Natural-language search query from the user.

    Returns:
        A deduplicated, merged list of result dicts suitable for parse_item().
    """
    # ── Channel 1: vector similarity (CHUNKS) ──────────────────────────────
    async def _vector_channel() -> list[dict]:
        try:
            raw = await cognee.search(
                query_text=query,
                query_type=SearchType.CHUNKS,
            )
            items = _normalise_to_list(raw)
            return [_normalise_chunk_item(i) for i in items if i is not None]
        except Exception as exc:
            print(f"[recall] CHUNKS channel error (non-fatal): {exc}")
            return []

    # ── Channel 2: graph topology (GRAPH_COMPLETION) ───────────────────────
    async def _graph_channel() -> list[dict]:
        try:
            raw = await cognee.search(
                query_text=query,
                query_type=SearchType.GRAPH_COMPLETION,
                only_context=True,
            )
            items = _normalise_to_list(raw)
            return [_normalise_graph_item(i) for i in items if i is not None]
        except Exception as exc:
            print(f"[recall] GRAPH_COMPLETION channel error (non-fatal): {exc}")
            return []

    # ── Concurrent retrieval ───────────────────────────────────────────────
    try:
        vector_results, graph_results = await asyncio.gather(
            _vector_channel(),
            _graph_channel(),
        )
    except Exception as exc:
        # asyncio.gather itself shouldn't raise since each sub-task is guarded,
        # but add a safety net anyway.
        print(f"[recall] asyncio.gather error: {exc}")
        vector_results, graph_results = [], []

    # ── Merge: vector results first (higher granularity), graph context second
    merged = vector_results + graph_results
    deduped = _dedup(merged)

    # ── Graceful degradation: both channels empty → fall back to cognee.recall()
    if not deduped:
        print("[recall] Both hybrid channels returned empty — falling back to cognee.recall()")
        try:
            fallback = await cognee.recall(query)
            return _normalise_to_list(fallback)
        except Exception as exc:
            print(f"[recall] cognee.recall() fallback error: {exc}")
            return []

    print(
        f"[recall] hybrid search — vector={len(vector_results)} "
        f"graph={len(graph_results)} merged={len(deduped)}"
    )
    return deduped


# ─── Convenience wrapper ──────────────────────────────────────────────────────

async def recall_text(query: str, limit: int = 5) -> list[str]:
    """Return a list of clean text strings from Cognee memory for a given query."""
    try:
        raw = await search_memory(query)
    except Exception as exc:
        print(f"[recall] search_memory error: {exc}")
        return []

    if not raw:
        return []

    items = raw if isinstance(raw, list) else [raw]
    texts: list[str] = []
    for item in items[:limit]:
        t = extract_text(item)
        if t:
            texts.append(t)
    return texts
