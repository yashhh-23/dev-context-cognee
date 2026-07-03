import re
import asyncio
import subprocess
import shutil
import tempfile
import os
import time
from app.models.session import SessionRecord
from app.core.database import SessionLocal
from app.core.config import settings
from app.core.ws_manager import manager
from app.core.cognee_client import cognify_with_fallback
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
                await cognify_with_fallback()
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
        byok_key_var.reset(token)

async def process_github_ingest(session_id: str, payload: dict, byok_key: str = None):
    from app.core.byok import byok_key_var
    token = byok_key_var.set(byok_key or "")
    db = SessionLocal()
    record = None
    tmp_dir = tempfile.mkdtemp()
    
    start_time = time.time()
    files_processed = 0
    nodes_created = 0
    
    try:
        record = db.query(SessionRecord).filter(SessionRecord.id == session_id).first()
        if not record:
            return

        record.status = "processing"
        db.commit()

        repo_url = payload.get("repo_url", "").strip()
        if not repo_url.startswith("http://") and not repo_url.startswith("https://"):
            repo_url = f"https://{repo_url}"
            
        branch = payload.get("branch", "main")
        
        await manager.broadcast({
            "type": "INGEST_PROGRESS",
            "payload": {"message": f"Cloning repository {repo_url} (branch: {branch})...", "progress": 10}
        })
        
        await asyncio.to_thread(
            subprocess.run,
            ["git", "clone", "--depth", "1", "-b", branch, repo_url, tmp_dir],
            check=True,
            capture_output=True
        )
        
        await manager.broadcast({
            "type": "INGEST_PROGRESS",
            "payload": {"message": f"[OK] Repository connected and downloaded.", "progress": 30}
        })

        # Walk files
        file_paths = []
        for root, dirs, files in os.walk(tmp_dir):
            if ".git" in dirs:
                dirs.remove(".git")
            for file in files:
                if not file.startswith(".") and not file.endswith((".png", ".jpg", ".pdf", ".zip")):
                    file_paths.append(os.path.join(root, file))
                    
        total_files = len(file_paths)
        max_files = getattr(settings, "MAX_INGEST_FILES", None)
        if max_files:
            file_paths = file_paths[:max_files]

        await manager.broadcast({
            "type": "INGEST_PROGRESS",
            "payload": {"message": f"Scanning file structure... found {total_files} files.", "progress": 40}
        })

        for i, path in enumerate(file_paths):
            try:
                if os.path.getsize(path) > 100_000:
                    continue
                with open(path, "r", encoding="utf-8", errors="ignore") as f:
                    content = f.read()
                
                rel_path = os.path.relpath(path, tmp_dir)
                formatted_content = f"File: {rel_path}\nSource: github\nContent:\n{content}"
                
                if i % 10 == 0:
                    await manager.broadcast({
                        "type": "INGEST_PROGRESS",
                        "payload": {"message": f"Analyzing AST: {rel_path}...", "progress": 40 + int(40 * (i/len(file_paths)))}
                    })
                    
                result = await cognee.add(formatted_content, dataset_name="main_dataset")
                files_processed += 1
                nodes_created += 1 if getattr(result, "id", None) else (1 if result else 0)
                
            except Exception as e:
                pass

        await manager.broadcast({
            "type": "INGEST_PROGRESS",
            "payload": {"message": "Building Cognee knowledge graph nodes...", "progress": 85}
        })
        
        await cognify_with_fallback()
        
        record.status = "completed"
        db.commit()

        time_taken = round(time.time() - start_time, 1)

        await manager.broadcast({
            "type": "INGEST_SUCCESS",
            "payload": {
                "message": "[OK] Ingestion completed! Code base successfully indexed in Cognee.",
                "progress": 100,
                "files_processed": files_processed,
                "nodes_created": nodes_created,
                "time_taken": f"{time_taken}s",
                "session_id": session_id
            }
        })

    except Exception as e:
        if record:
            record.status = "failed"
            record.error_message = str(e)[:500]
            db.commit()
            
        await manager.broadcast({
            "type": "INGEST_ERROR",
            "payload": {"message": f"Ingestion failed: {e}", "progress": 0}
        })
    finally:
        shutil.rmtree(tmp_dir, ignore_errors=True)
        db.close()
        byok_key_var.reset(token)
