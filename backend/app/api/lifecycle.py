"""POST /improve/{session_id} and DELETE /forget/{session_id}."""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from typing import Optional
from app.core.database import get_db
from app.services.recall_service import get_session
from app.core.ws_manager import manager
from app.core.config import settings
from app.models.session import SessionRecord, PinnedNode
import cognee
import difflib

router = APIRouter()

from cognee.modules.session_lifecycle import ensure_session, mark_ended, SessionStatus
from cognee.modules.session_distillation import distill_session
import uuid

class SessionStartRequest(BaseModel):
    sessionId: str
    workspaceName: Optional[str] = None

class SessionEndRequest(BaseModel):
    sessionId: str
    triggerDistillation: bool = True

_default_user = uuid.UUID("00000000-0000-0000-0000-000000000000")

@router.post("/session/start")
async def start_session(body: SessionStartRequest):
    try:
        await ensure_session(session_id=body.sessionId, user_id=_default_user)
        return {"status": "started", "session_id": body.sessionId}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to start session: {str(e)}")

@router.post("/session/end")
async def end_session(body: SessionEndRequest):
    try:
        await mark_ended(session_id=body.sessionId, user_id=_default_user, status=SessionStatus.COMPLETED)
        if body.triggerDistillation:
            await distill_session(session_id=body.sessionId, dataset="main_dataset")
        return {"status": "ended", "session_id": body.sessionId}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to end session: {str(e)}")

from app.utils.embedding_utils import (
    get_text_embedding,
    cosine_similarity,
    EXACT_MATCH_THRESHOLD,
    SUPERSEDE_MIN_THRESHOLD,
    SUPERSEDE_MAX_THRESHOLD,
    DIFFLIB_FAST_RATIO,
    sanitize_dataset_name,
)
from app.utils.llm_utils import ask_gemini, ask_groq, SUPERSEDE_PROMPT
import logging
logger = logging.getLogger(__name__)

async def _is_superseded_by_llm(mem_a: str, mem_b: str) -> bool:
    """
    Ask LLM whether mem_b supersedes mem_a.
    Chain: Gemini Flash → Groq → skip (return False = don't delete).
    """
    prompt = SUPERSEDE_PROMPT.format(mem_a=mem_a[:400], mem_b=mem_b[:400])
    api_key = settings.GEMINI_API_KEY
    result = await ask_gemini(prompt, api_key) if api_key else None
    if result is None:
        api_key = settings.GROQ_API_KEY
        result = await ask_groq(prompt, api_key) if api_key else None
        
    if result is None:
        logger.warning("Skipping supersede check: LLM unavailable")
        return False
        
    return result.strip().upper().startswith("YES")


async def _forget_session_helper(s: SessionRecord, pinned_ids: set[str], db: Session) -> bool:
    """Call cognee.forget + mark DB. Returns True on success."""
    if str(s.id) in pinned_ids:
        logger.info(f"Session {s.id} is protected by pin")
        return False  # safety guard
    try:
        count = db.query(SessionRecord).filter(
            SessionRecord.project == s.project,
            SessionRecord.branch == s.branch,
            SessionRecord.status.in_(["completed", "resolved"])
        ).count()
        if count <= 1:
            dataset_name = sanitize_dataset_name(f"{s.project}_{s.branch}")
            await cognee.forget(dataset_name=dataset_name)
        s.status = "forgotten"
        return True
    except Exception as exc:
        print(f"[auto-clean] cognee.forget failed for {s.id}: {exc}")
        return False


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
        count = db.query(SessionRecord).filter(
            SessionRecord.project == record.project,
            SessionRecord.branch == record.branch,
            SessionRecord.status.in_(["completed", "resolved"])
        ).count()
        if count <= 1:
            dataset_name = sanitize_dataset_name(f"{record.project}_{record.branch}")
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
    sessions = (
        db.query(SessionRecord)
        .filter(SessionRecord.status.in_(["completed", "resolved"]))
        .order_by(SessionRecord.timestamp.asc())
        .all()
    )
    sessions = sessions[-50:]

    # Build pinned id set for fast O(1) lookup
    pinned_ids = {
        r.node_id
        for r in db.query(PinnedNode).filter(PinnedNode.pinned == True).all()  # noqa: E712
    }

    cleaned_exact = 0        # Phase 1 removals
    cleaned_supersede = 0    # Phase 2 removals
    llm_calls = 0
    MAX_LLM_CALLS = 20

    # Group sessions by (project, branch) to avoid cross-project O(N2) comparisons
    from collections import defaultdict
    grouped = defaultdict(list)
    for s in sessions:
        grouped[(s.project, s.branch)].append(s)

    for (proj, branch), s_list in grouped.items():
        kept: list[SessionRecord] = []
        for session in s_list:
            text = (session.terminal_output or "").strip()
            if not text or str(session.id) in pinned_ids:
                kept.append(session)
                continue

            removed = False
            for kept_session in kept:
                kept_text = (kept_session.terminal_output or "").strip()
                if not kept_text:
                    continue

                # ── Step 1: Try high-precision semantic embedding similarity ──
                emb1 = await get_text_embedding(text)
                emb2 = await get_text_embedding(kept_text)

                if emb1 is not None and emb2 is not None:
                    sim = cosine_similarity(emb1, emb2)
                else:
                    # Fallback to difflib SequenceMatcher if embedding fails
                    # Optimize: quick check on length ratio first
                    len_ratio = min(len(text), len(kept_text)) / max(len(text), len(kept_text)) if max(len(text), len(kept_text)) > 0 else 0
                    if len_ratio < DIFFLIB_FAST_RATIO:
                        continue
                    matcher = difflib.SequenceMatcher(None, text.lower(), kept_text.lower())
                    if matcher.real_quick_ratio() < DIFFLIB_FAST_RATIO:
                        continue
                    if matcher.quick_ratio() < DIFFLIB_FAST_RATIO:
                        continue
                    sim = matcher.ratio()

                # ── Phase 1: exact-ish duplicate ──────────────────────────────
                if sim >= EXACT_MATCH_THRESHOLD or text.lower() in kept_text.lower() or kept_text.lower() in text.lower():
                    if await _forget_session_helper(session, pinned_ids, db):
                        cleaned_exact += 1
                        removed = True
                        break

                # ── Phase 2: similar but not identical → ask LLM ─────────────
                elif SUPERSEDE_MIN_THRESHOLD <= sim < SUPERSEDE_MAX_THRESHOLD and llm_calls < MAX_LLM_CALLS:
                    llm_calls += 1
                    # session is NEWER (sorted asc), kept_session is OLDER
                    superseded = await _is_superseded_by_llm(
                        mem_a=kept_text,
                        mem_b=text,
                    )
                    if superseded:
                        # Newer (session) supersedes older (kept_session): drop the older one
                        if await _forget_session_helper(kept_session, pinned_ids, db):
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
