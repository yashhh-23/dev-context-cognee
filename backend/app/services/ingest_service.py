import re
import asyncio
from app.models.session import SessionRecord
from app.core.database import SessionLocal
from app.core.ws_manager import manager
import cognee

_cognify_lock = asyncio.Lock()
_needs_cognify = False

async def _debounced_cognify():
    global _needs_cognify
    await asyncio.sleep(15)  # Wait 15s to batch multiple saves
    async with _cognify_lock:
        if _needs_cognify:
            _needs_cognify = False
            try:
                await cognee.cognify()
            except Exception as e:
                print(f"[DEBUG] Debounced cognify failed: {e}")



def clean_terminal_output(text: str) -> str:
    text = re.sub(
        r"(api[_\-]?key|secret|token|password)[\s:=]+['\x22]?[A-Za-z0-9_\-\.]+['\x22]?",
        r'\1: [REDACTED]',
        text,
        flags=re.IGNORECASE,
    )
    ansi_escape = re.compile(r'\x1B(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~])')
    text = ansi_escape.sub('', text)
    if len(text) > 50000:
        text = text[:50000] + "\n...[TRUNCATED]"
    return text


async def process_ingest(session_id: str, payload: dict, byok_key: str = None):
    db = SessionLocal()
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
        record.status = "failed"
        record.error_message = str(e)[:500]
        db.commit()
    finally:
        db.close()


async def process_file_ingest(session_id: str, payload: dict):
    db = SessionLocal()
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

        await cognee.add(formatted_content, dataset_name="main_dataset")
        
        global _needs_cognify
        _needs_cognify = True
        asyncio.create_task(_debounced_cognify())

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
        record.status = "failed"
        record.error_message = str(e)[:500]
        db.commit()
    finally:
        db.close()
