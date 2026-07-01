import re
import asyncio
from app.models.session import SessionRecord
from app.core.database import SessionLocal
from app.core.config import settings
from app.core.ws_manager import manager
import cognee

from typing import Optional

_cognify_task: Optional[asyncio.Task] = None
_cognify_lock = asyncio.Lock()

async def _debounced_cognify(delay: float = 15.0):
    global _cognify_task
    async with _cognify_lock:
        if _cognify_task and not _cognify_task.done():
            _cognify_task.cancel()
        async def _run():
            await asyncio.sleep(delay)
            try:
                await cognee.cognify()
            except Exception as e:
                print(f"[DEBUG] Debounced cognify failed: {e}")
        _cognify_task = asyncio.create_task(_run())



def clean_terminal_output(text: str) -> str:
    text = re.sub(
        r'(api[_-]?key|secret|token|password|access[_-]?key|private[_-]?key|'
        r'aws[_-]?secret|client[_-]?secret|auth[_-]?token|bearer)'
        r'\s*[=:]\s*[\w\-\.]+',
        r'\1: [REDACTED]',
        text,
        flags=re.IGNORECASE,
    )
    ansi_escape = re.compile(r'\x1B(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~])')
    text = ansi_escape.sub('', text)
    max_chars = getattr(settings, 'MAX_LOG_CHARS', 50000)
    if len(text) > max_chars:
        text = text[:max_chars] + "\n...[TRUNCATED]"
    return text


async def process_ingest(session_id: str, payload: dict, byok_key: str = None):
    db = SessionLocal()
    record = None
    try:
        record = db.query(SessionRecord).filter(SessionRecord.id == session_id).first()
        if not record:
            return

        record.status = "processing"
        db.commit()

        cleaned = clean_terminal_output(payload.get("terminal_output", ""))
        project = payload.get("project", "unknown_project")
        branch  = payload.get("branch", "unknown_branch")
        commit  = payload.get("commit_hash", "")
        tags    = payload.get("tags", [])

        memory_text = (
            f"Project: {project}\n"
            f"Branch: {branch}\n"
            f"Commit: {commit}\n"
            f"Tags: {', '.join(tags) if tags else 'none'}\n"
            f"Log:\n{cleaned}"
        )

        await cognee.remember(memory_text)

        record.status = "completed"
        db.commit()

        # Notify dashboard via WebSocket
        await manager.broadcast({
            "type": "memory_stored",
            "payload": {
                "label": f"Log ingested for {project}",
                "session_id": session_id,
                "project": project,
            }
        })

    except Exception as e:
        if record:
            record.status = "failed"
            record.error_message = str(e)[:500]
            db.commit()
    finally:
        db.close()


async def process_file_ingest(session_id: str, payload: dict, byok_key: str = None):
    from app.core.byok import byok_key_var
    token = byok_key_var.set(byok_key or "")
    try:
        db = SessionLocal()
        record = None
        try:
            record = db.query(SessionRecord).filter(SessionRecord.id == session_id).first()
            if not record:
                return

            record.status = "processing"
            db.commit()

            content = payload.get("content", "")
            file_name = payload.get("fileName", "")
            lang = payload.get("languageId", "")
            source = payload.get("source", "vscode-extension")
            symbols = payload.get("symbols", [])

            symbols_str = f"Symbols: {', '.join(symbols)}" if symbols else ""
            formatted_content = f"File: {file_name}\nLanguage: {lang}\nSource: {source}\n{symbols_str}\nContent:\n{content}"

            # Log to terminal_output as well to respect BYOK encryption
            record.terminal_output = f"[File Context: {file_name}]\n{content}"

            result = await cognee.add(formatted_content, dataset_name="main_dataset")
            record.cognee_response_id = str(result.id) if hasattr(result, 'id') else None
            await _debounced_cognify()

            record.status = "completed"
            db.commit()

            # Notify dashboard via WebSocket
            await manager.broadcast({
                "type": "memory_stored",
                "payload": {
                    "label": f"File ingested: {file_name}",
                    "session_id": session_id,
                    "project": file_name,
                }
            })

        except Exception as e:
            if record:
                record.status = "failed"
                record.error_message = str(e)[:500]
                db.commit()
        finally:
            db.close()
    finally:
        byok_key_var.reset(token)
