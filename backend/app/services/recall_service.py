from sqlalchemy.orm import Session
from app.models.session import SessionRecord
import cognee


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


def extract_text(item) -> str:
    """Safely extract human-readable text from any Cognee recall result type.

    Cognee can return SearchResult dataclasses, dicts, or plain strings.
    Their __repr__ looks like: kind='temporal' search_type='TEMPORAL' text="..."
    We want only the text/content value.
    """
    if item is None:
        return ""

    # Dict-style result
    if isinstance(item, dict):
        return (
            item.get("text")
            or item.get("content")
            or item.get("value")
            or str(item)
        )

    # Cognee SearchResult / dataclass — has .text attribute
    for attr in ("text", "content", "value", "description"):
        val = getattr(item, attr, None)
        if val and isinstance(val, str) and val.strip():
            return val.strip()

    # Last resort: stringify but strip the dataclass noise
    raw = str(item)
    # If it looks like a repr (kind='...'), try to extract text='...' substring
    import re
    match = re.search(r"text=['\"](.+?)['\"](\s|$|,)", raw, re.DOTALL)
    if match:
        return match.group(1).strip()
    match = re.search(r"content=['\"](.+?)['\"](\s|$|,)", raw, re.DOTALL)
    if match:
        return match.group(1).strip()

    return raw


async def search_memory(query: str):
    """Recall relevant memory nodes from Cognee."""
    return await cognee.recall(query)


async def recall_text(query: str, limit: int = 5) -> list[str]:
    """Return a list of clean text strings from Cognee memory for a given query."""
    try:
        raw = await search_memory(query)
    except Exception as e:
        print(f"[recall] search_memory error: {e}")
        return []

    if not raw:
        return []

    items = raw if isinstance(raw, list) else [raw]
    texts = []
    for item in items[:limit]:
        t = extract_text(item)
        if t:
            texts.append(t)
    return texts
