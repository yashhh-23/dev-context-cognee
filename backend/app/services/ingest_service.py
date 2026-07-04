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
                await cognify_with_fallback(datasets=["main_dataset"])
            except Exception as e:
                print(f"[DEBUG] Debounced cognify failed: {e}")
        _cognify_task = asyncio.create_task(_run())

import fnmatch

class GitIgnoreMatcher:
    def __init__(self, base_dir: str):
        self.base_dir = os.path.abspath(base_dir)
        self.rules = []
        
        # Default ignored patterns to exclude standard build / environment directories and binary types
        default_patterns = [
            ".git/", ".github/", "node_modules/", "venv/", ".venv/", "env/", ".env",
            "__pycache__/", "*.pyc", "*.pyo", "*.pyd", "dist/", "build/", ".next/",
            ".nuxt/", "out/", "target/", ".idea/", ".vscode/", "tmp/", "temp/",
            # compiled / binary types
            "*.png", "*.jpg", "*.jpeg", "*.gif", "*.ico", "*.pdf", "*.zip", "*.tar", "*.gz", "*.rar", "*.7z",
            "*.exe", "*.dll", "*.so", "*.dylib", "*.bin", "*.db", "*.sqlite", "*.sqlite3", "*.woff", "*.woff2",
            "*.ttf", "*.eot", "*.mp4", "*.mp3", "*.wav", "*.avi", "*.mov", "*.flv", "*.wmv", "*.mkv",
            "*.class", "*.o", "*.a", "*.lib", "*.obj", "*.pyc", "*.pyo", "*.pyd"
        ]
        for pat in default_patterns:
            self._add_rule(pat)

        # Try to read local .gitignore from cloned repo
        gitignore_path = os.path.join(self.base_dir, ".gitignore")
        if os.path.exists(gitignore_path):
            try:
                with open(gitignore_path, "r", encoding="utf-8", errors="ignore") as f:
                    for line in f:
                        line = line.strip()
                        if line and not line.startswith("#"):
                            self._add_rule(line)
            except Exception as e:
                print(f"[gitignore] warning: failed to read .gitignore: {e}")

    def _add_rule(self, pattern: str):
        is_dir_only = pattern.endswith("/")
        clean_pat = pattern.rstrip("/")
        is_root_relative = clean_pat.startswith("/")
        if is_root_relative:
            clean_pat = clean_pat[1:]
            
        self.rules.append({
            "pattern": clean_pat,
            "is_dir_only": is_dir_only,
            "is_root_relative": is_root_relative
        })

    def is_ignored(self, path: str, is_dir: bool = False) -> bool:
        abs_path = os.path.abspath(path)
        rel_path = os.path.relpath(abs_path, self.base_dir).replace("\\", "/")
        segments = rel_path.split("/")
        
        for rule in self.rules:
            pat = rule["pattern"]
            is_dir_only = rule["is_dir_only"]
            is_root_relative = rule["is_root_relative"]
            
            if is_dir_only and not is_dir:
                continue
                
            if is_root_relative:
                if fnmatch.fnmatchcase(rel_path, pat) or fnmatch.fnmatchcase(segments[0], pat):
                    return True
                if "**" in pat:
                    translated = pat.replace("**", "*")
                    if fnmatch.fnmatchcase(rel_path, translated):
                        return True
            else:
                for segment in segments:
                    if fnmatch.fnmatchcase(segment, pat):
                        return True
                if "/" in pat:
                    if fnmatch.fnmatchcase(rel_path, pat):
                        return True
                    if f"/{pat}/" in f"/{rel_path}/" or rel_path.startswith(pat + "/"):
                        return True
                            
        return False


def is_binary(file_path: str) -> bool:
    try:
        with open(file_path, "rb") as f:
            chunk = f.read(1024)
            if b"\x00" in chunk:
                return True
        return False
    except Exception:
        return True


def chunk_code(content: str, rel_path: str, max_lines: int = 150, overlap_lines: int = 15) -> list[str]:
    lines = content.splitlines()
    if len(lines) <= max_lines:
        return [f"File: {rel_path}\nContent:\n{content}"]
        
    chunks = []
    i = 0
    while i < len(lines):
        chunk_lines = lines[i : i + max_lines]
        chunks.append("\n".join(chunk_lines))
        i += (max_lines - overlap_lines)
        
    total_chunks = len(chunks)
    formatted_chunks = []
    for idx, chunk_content in enumerate(chunks):
        formatted_chunk = (
            f"File: {rel_path} (Part {idx + 1}/{total_chunks})\n"
            f"Content:\n{chunk_content}"
        )
        formatted_chunks.append(formatted_chunk)
        
    return formatted_chunks


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
            "payload": {"description": f"Cloning repository {repo_url} (branch: {branch})...", "progress": 10}
        })
        
        await asyncio.to_thread(
            subprocess.run,
            ["git", "clone", "--depth", "1", "-b", branch, repo_url, tmp_dir],
            check=True,
            capture_output=True
        )
        
        await manager.broadcast({
            "type": "INGEST_PROGRESS",
            "payload": {"description": f"[OK] Repository connected and downloaded.", "progress": 30}
        })
        # Walk files with GitIgnoreMatcher and is_binary checks
        matcher = GitIgnoreMatcher(tmp_dir)
        file_paths = []
        for root, dirs, files in os.walk(tmp_dir):
            # Prune ignored directories in-place to speed up walking
            dirs[:] = [d for d in dirs if not matcher.is_ignored(os.path.join(root, d), is_dir=True)]
            
            for file in files:
                full_path = os.path.join(root, file)
                if matcher.is_ignored(full_path, is_dir=False):
                    continue
                if is_binary(full_path):
                    continue
                file_paths.append(full_path)
                    
        total_files = len(file_paths)
        max_files = getattr(settings, "MAX_INGEST_FILES", None)
        if max_files:
            file_paths = file_paths[:max_files]

        await manager.broadcast({
            "type": "INGEST_PROGRESS",
            "payload": {"description": f"Scanning file structure... found {total_files} files.", "progress": 40}
        })

        for i, path in enumerate(file_paths):
            try:
                if os.path.getsize(path) > 100_000:
                    continue
                with open(path, "r", encoding="utf-8", errors="ignore") as f:
                    content = f.read()
                
                rel_path = os.path.relpath(path, tmp_dir)
                
                if i % 10 == 0:
                    await manager.broadcast({
                        "type": "INGEST_PROGRESS",
                        "payload": {"description": f"Analyzing AST: {rel_path}...", "progress": 40 + int(40 * (i/len(file_paths)))}
                    })
                    
                chunks = chunk_code(content, rel_path)
                for chunk_content in chunks:
                    result = await cognee.add(chunk_content, dataset_name="main_dataset")
                    nodes_created += 1 if getattr(result, "id", None) else (1 if result else 0)
                
                files_processed += 1
                
            except Exception as e:
                print(f"[ERROR] Failed to ingest {path}: {e}")
                pass

        await manager.broadcast({
            "type": "INGEST_PROGRESS",
            "payload": {"description": "Building Cognee knowledge graph nodes...", "progress": 85}
        })
        await cognify_with_fallback(datasets=["main_dataset"])
        
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
