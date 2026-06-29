import re
from app.models.session import SessionRecord
from app.core.database import SessionLocal
import cognee


def clean_terminal_output(text: str) -> str:
    # Redact obvious secrets
    text = re.sub(
        r'(api[_\-]?key|secret|token|password)[\s:=]+[\'"']?[A-Za-z0-9_\-\.]+[\'"']?',
        r'\1: [REDACTED]',
        text,
        flags=re.IGNORECASE,
    )
    # Strip ANSI escape codes
    ansi_escape = re.compile(r'\x1B(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~])')
    text = ansi_escape.sub('', text)
    # Truncate huge logs
    max_length = 50000
    if len(text) > max_length:
        text = text[:max_length] + "\n...[TRUNCATED]"
    return text


async def process_ingest(session_id: str, payload: dict):
    db = SessionLocal()
    try:
        session_record = db.query(SessionRecord).filter(SessionRecord.id == session_id).first()

        if not session_record:
            return

        session_record.status = "processing"
        db.commit()

        cleaned_text = clean_terminal_output(payload.get("terminal_output", ""))

        project = payload.get("project", "unknown_project")
        branch = payload.get("branch", "unknown_branch")

        # Contextualized memory text for Cognee
        contextualized_text = (
            f"Project: {project}\nBranch: {branch}\nLog Content:\n{cleaned_text}"
        )

        # cognee v1.0: remember() replaces add() + cognify() + memify()
        await cognee.remember(contextualized_text)

        session_record.status = "completed"
        db.commit()

    except Exception as e:
        session_record.status = "failed"
        session_record.error_message = str(e)
        db.commit()
    finally:
        db.close()
