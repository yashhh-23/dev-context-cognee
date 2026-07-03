import asyncio
import time
import os
import json
import sys
import datetime
import subprocess
from pathlib import Path
from watchfiles import awatch

DAEMON_PID_FILE = Path.home() / ".devcontext" / "daemon.pid"
DAEMON_INFO_FILE = Path.home() / ".devcontext" / "daemon.json"

async def flush_buffer(buffer: list, api_url: str, api_key: str, project_dir: str, session_id: str = None):
    import requests
    if not buffer:
        return
    try:
        payload = {
            "project": os.path.basename(os.path.abspath(project_dir)),
            "branch": "unknown_branch",
            "terminal_output": json.dumps(buffer),
            "tags": ["cli-daemon-watch"],
            "timestamp": datetime.datetime.now(datetime.timezone.utc).isoformat()
        }
        if session_id:
            payload["session_id"] = session_id
        
        headers = {}
        if api_key and api_key != "NONE":
            headers["X-BYOK-Key"] = api_key
            
        requests.post(f"{api_url}/ingest", json=payload, headers=headers, timeout=10)
    except Exception as e:
        # Silently fail in background daemon
        pass

def should_track(change, path):
    parts = Path(path).parts
    if any(p.startswith('.') or p in ('node_modules', '__pycache__', 'venv', 'env') for p in parts):
        return False
    return True

def get_file_content(path: str, project_dir: str) -> str:
    try:
        result = subprocess.run(
            ["git", "diff", "HEAD", "--", path],
            cwd=project_dir,
            capture_output=True,
            text=True,
            timeout=2
        )
        if result.returncode == 0 and result.stdout.strip():
            return result.stdout.strip()
    except Exception:
        pass
        
    try:
        if os.path.isfile(path) and os.path.getsize(path) < 50_000:
            with open(path, "r", encoding="utf-8", errors="ignore") as f:
                return f.read(50_000)
    except Exception:
        pass
    return ""

async def watch_and_collect(api_url: str, api_key: str, project_dir: str, session_id: str = None):
    buffer = []
    last_flush = time.time()
    
    try:
        async for changes in awatch(project_dir, watch_filter=should_track):
            for change_type, path in changes:
                try:
                    rel_path = os.path.relpath(path, project_dir)
                    content_snippet = get_file_content(path, project_dir) if change_type.name != 'deleted' else ""
                    entry = {
                        "path": rel_path,
                        "change": change_type.name,
                        "timestamp": time.time(),
                        "content": content_snippet,
                    }
                    buffer.append(entry)
                except ValueError:
                    pass
            
            if time.time() - last_flush > 30 or len(buffer) >= 20:
                await flush_buffer(buffer, api_url, api_key, project_dir, session_id)
                buffer.clear()
                last_flush = time.time()
    except asyncio.CancelledError:
        if buffer:
            await flush_buffer(buffer, api_url, api_key, project_dir, session_id)
        raise
    except Exception:
        pass

def main():
    if len(sys.argv) < 4:
        return
    api_url = sys.argv[1]
    api_key = sys.argv[2]
    project_dir = sys.argv[3]
    session_id = sys.argv[4] if len(sys.argv) > 4 else None
    
    DAEMON_PID_FILE.parent.mkdir(exist_ok=True)
    DAEMON_PID_FILE.write_text(str(os.getpid()))
    
    DAEMON_INFO_FILE.write_text(json.dumps({
        "pid": os.getpid(),
        "project_dir": os.path.abspath(project_dir),
        "start_time": datetime.datetime.now().isoformat(),
        "session_id": session_id
    }))
    
    try:
        asyncio.run(watch_and_collect(api_url, api_key, project_dir, session_id))
    finally:
        if DAEMON_PID_FILE.exists():
            try:
                DAEMON_PID_FILE.unlink()
            except Exception:
                pass
        if DAEMON_INFO_FILE.exists():
            try:
                DAEMON_INFO_FILE.unlink()
            except Exception:
                pass

if __name__ == "__main__":
    main()
