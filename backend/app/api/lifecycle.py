"""POST /improve/{session_id} and DELETE /forget/{session_id}."""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from typing import Optional
from app.core.database import get_db
from app.services.recall_service import get_session
from app.core.ws_manager import manager
from app.core.config import settings
import cognee
import asyncio
import difflib
import httpx

router = APIRouter()

# ---------------------------------------------------------------------------
# LLM helper — Gemini 1.5 Flash → Groq llama-3.1-8b fallback
# ---------------------------------------------------------------------------

_SUPERSEDE_PROMPT = """You are a memory deduplication assistant.
Below are two memory entries stored in a developer's context memory system.

Memory A (OLDER):
{mem_a}

Memory B (NEWER):
{mem_b}

Does Memory B supersede (replace / make obsolete) Memory A?
A supersedes B only when B represents an UPDATED state of the same fact (e.g. 'bug fixed' supersedes 'bug exists', 'PR merged' supersedes 'PR open').
Do NOT answer YES if both could be true at the same time, or if they describe different things.

Answer with exactly one word: YES or NO."""


async def _ask_gemini(mem_a: str, mem_b: str) -> Optional[bool]:
    """Returns True=supersede, False=not, None=skip (uncertain/error)."""
    api_key = settings.GEMINI_API_KEY
    if not api_key:
        return None
    prompt = _SUPERSEDE_PROMPT.format(mem_a=mem_a[:400], mem_b=mem_b[:400])
    url = (
        "https://generativelanguage.googleapis.com/v1beta/models/"
        "gemini-1.5-flash:generateContent"
    )
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.post(
                url,
                params={"key": api_key},
                json={"contents": [{"parts": [{"text": prompt}]}]},
            )
        if resp.status_code != 200:
            return None
        text = (
            resp.json()
            .get("candidates", [{}])[0]
            .get("content", {})
            .get("parts", [{}])[0]
            .get("text", "")
            .strip()
            .upper()
        )
        if text.startswith("YES"):
            return True
        if text.startswith("NO"):
            return False
        return None
    except Exception:
        return None


async def _ask_groq(mem_a: str, mem_b: str) -> Optional[bool]:
    """Groq llama-3.1-8b-instant fallback."""
    api_key = settings.GROQ_API_KEY
    if not api_key:
        return None
    prompt = _SUPERSEDE_PROMPT.format(mem_a=mem_a[:400], mem_b=mem_b[:400])
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.post(
                "https://api.groq.com/openai/v1/chat/completions",
                headers={"Authorization": f"Bearer {api_key}"},
                json={
                    "model": "llama-3.1-8b-instant",
                    "messages": [{"role": "user", "content": prompt}],
                    "max_tokens": 4,
                    "temperature": 0,
                },
            )
        if resp.status_code != 200:
            return None
        text = (
            resp.json()
            .get("choices", [{}])[0]
            .get("message", {})
            .get("content", "")
            .strip()
            .upper()
        )
        if text.startswith("YES"):
            return True
        if text.startswith("NO"):
            return False
        return None
    except Exception:
        return None


async def _is_superseded_by_llm(mem_a: str, mem_b: str) -> bool:
    """
    Ask LLM whether mem_b supersedes mem_a.
    Chain: Gemini Flash → Groq → skip (return False = don't delete).
    """
    result = await _ask_gemini(mem_a, mem_b)
    if result is None:
        result = await _ask_groq(mem_a, mem_b)
    return result is True  # None or False both mean "don't delete"


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

class ImproveRequest(BaseModel):
    fix_text: Optional[str] = None


@router.post("/improve/{session_id}")
async def improve_session(
    session_id: str,
    body: ImproveRequest,
    db: Session = Depends(get_db),
):
    """Mark a session resolved and call cognee.improve() to update the memory embedding."""
    record = get_session(db, session_id)
    if not record:
        raise HTTPException(status_code=404, detail="Session not found")

    fix_note = body.fix_text or ""
    context = (
        f"RESOLVED — Project: {record.project} | Branch: {record.branch}\n"
        f"Original log:\n{(record.terminal_output or '')[:1000]}\n"
        f"Fix applied: {fix_note}"
    )
    try:
        await cognee.improve(context)
        record.status = "resolved"
        record.error_message = fix_note
        try:
            raw = await cognee.recall(f"Project: {record.project} Branch: {record.branch}")
            items = raw if isinstance(raw, list) else [raw] if raw else []
            record.context_size = len(items)
        except Exception:
            record.context_size = 1
        db.commit()
    except Exception as e:
        record.status = "resolved"
        record.error_message = f"cognee.improve warning: {str(e)}"
        db.commit()

    await manager.broadcast({"type": "session_resolved", "session_id": session_id})
    return {"status": "resolved", "session_id": session_id}


@router.delete("/forget/{session_id}")
async def forget_session(session_id: str, db: Session = Depends(get_db)):
    """Remove session from Cognee memory and mark forgotten in DB."""
    record = get_session(db, session_id)
    if not record:
        raise HTTPException(status_code=404, detail="Session not found")

    try:
        dataset_name = (
            f"{record.project}_{record.branch}"
            .replace("/", "_")
            .replace("-", "_")
        )
        await cognee.forget(dataset_name=dataset_name)
        record.status = "forgotten"
        db.commit()
    except Exception as e:
        record.status = "forgotten"
        record.error_message = f"cognee.forget warning: {str(e)}"
        db.commit()

    await manager.broadcast({"type": "session_forgotten", "session_id": session_id})
    return {"status": "forgotten", "session_id": session_id}


@router.post("/memories/auto-clean")
async def auto_clean_memories(db: Session = Depends(get_db)):
    """
    Two-phase memory cleanup:
      Phase 1 — difflib dedup (similarity >= 0.85): fast, no LLM needed.
      Phase 2 — LLM supersede detection (0.55 <= similarity < 0.85):
                 Gemini 1.5 Flash decides if the newer memory replaces the older.
                 Safety: pinned sessions are NEVER touched.
                 Bound: max 20 LLM calls per run to stay free-tier safe.
    """
    from app.models.session import SessionRecord, PinnedNode

    sessions = (
        db.query(SessionRecord)
        .filter(SessionRecord.status.in_(["completed", "resolved"]))
        .order_by(SessionRecord.timestamp.asc())
        .all()
    )

    # Build pinned id set for fast O(1) lookup
    pinned_ids = {
        r.node_id
        for r in db.query(PinnedNode).filter(PinnedNode.pinned == True).all()  # noqa: E712
    }

    cleaned_exact = 0        # Phase 1 removals
    cleaned_supersede = 0    # Phase 2 removals
    llm_calls = 0
    MAX_LLM_CALLS = 20

    kept: list[SessionRecord] = []

    async def _forget_session(s: SessionRecord) -> bool:
        """Call cognee.forget + mark DB. Returns True on success."""
        if str(s.id) in pinned_ids:
            return False  # safety guard
        try:
            dataset_name = (
                f"{s.project}_{s.branch}"
                .replace("/", "_")
                .replace("-", "_")
            )
            await cognee.forget(dataset_name=dataset_name)
            s.status = "forgotten"
            return True
        except Exception as exc:
            print(f"[auto-clean] cognee.forget failed for {s.id}: {exc}")
            return False

    for session in sessions:
        text = (session.terminal_output or "").strip()
        if not text or str(session.id) in pinned_ids:
            kept.append(session)
            continue

        removed = False
        for kept_session in kept:
            kept_text = (kept_session.terminal_output or "").strip()
            if not kept_text:
                continue

            sim = difflib.SequenceMatcher(
                None, text.lower(), kept_text.lower()
            ).ratio()

            # ── Phase 1: exact-ish duplicate ──────────────────────────────
            if sim >= 0.85 or text.lower() in kept_text.lower() or kept_text.lower() in text.lower():
                if await _forget_session(session):
                    cleaned_exact += 1
                    removed = True
                    break

            # ── Phase 2: similar but not identical → ask LLM ─────────────
            elif 0.55 <= sim < 0.85 and llm_calls < MAX_LLM_CALLS:
                llm_calls += 1
                # session is NEWER (sorted asc), kept_session is OLDER
                superseded = await _is_superseded_by_llm(
                    mem_a=kept_text,
                    mem_b=text,
                )
                if superseded:
                    # Newer (session) supersedes older (kept_session): drop the older one
                    if await _forget_session(kept_session):
                        kept.remove(kept_session)
                        cleaned_supersede += 1
                    kept.append(session)
                    removed = True
                    break

        if not removed:
            kept.append(session)

    total_cleaned = cleaned_exact + cleaned_supersede
    if total_cleaned > 0:
        db.commit()

    return {
        "status": "success",
        "cleaned_count": total_cleaned,
        "cleaned_exact": cleaned_exact,
        "cleaned_supersede": cleaned_supersede,
        "llm_calls_used": llm_calls,
        "message": (
            f"Cleaned {total_cleaned} memories "
            f"({cleaned_exact} exact duplicates, {cleaned_supersede} superseded by LLM). "
            f"Used {llm_calls} LLM calls."
        ),
    }
