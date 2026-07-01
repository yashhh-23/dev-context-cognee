import asyncio
import time
import os
import json
import sys
import datetime
from pathlib import Path
from watchfiles import awatch

DAEMON_PID_FILE = Path.home() / ".devcontext" / "daemon.pid"
DAEMON_INFO_FILE = Path.home() / ".devcontext" / "daemon.json"

async def flush_buffer(buffer: list, api_url: str, api_key: str, project_dir: str):
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
        
        headers = {}
        if api_key and api_key != "NONE":
            headers["X-BYOK-Key"] = api_key
            
        requests.post(f"{api_url}/ingest/", json=payload, headers=headers, timeout=10)
    except Exception as e:
        # Silently fail in background daemon
        pass

def should_track(change, path):
    parts = Path(path).parts
    if any(p.startswith('.') or p in ('node_modules', '__pycache__', 'venv', 'env') for p in parts):
        return False
    return True

async def watch_and_collect(api_url: str, api_key: str, project_dir: str):
    buffer = []
    last_flush = time.time()
    
    try:
        async for changes in awatch(project_dir, watch_filter=should_track):
            for change_type, path in changes:
                try:
                    rel_path = os.path.relpath(path, project_dir)
                    entry = {
                        "path": rel_path,
                        "change": change_type.name,
                        "timestamp": time.time(),
                    }
                    buffer.append(entry)
                except ValueError:
                    pass
            
            if time.time() - last_flush > 30 or len(buffer) >= 20:
                await flush_buffer(buffer, api_url, api_key, project_dir)
                buffer.clear()
                last_flush = time.time()
    except asyncio.CancelledError:
        if buffer:
            await flush_buffer(buffer, api_url, api_key, project_dir)
        raise
    except Exception:
        pass

def main():
    if len(sys.argv) < 4:
        return
    api_url = sys.argv[1]
    api_key = sys.argv[2]
    project_dir = sys.argv[3]
    
    DAEMON_PID_FILE.parent.mkdir(exist_ok=True)
    DAEMON_PID_FILE.write_text(str(os.getpid()))
    
    DAEMON_INFO_FILE.write_text(json.dumps({
        "pid": os.getpid(),
        "project_dir": os.path.abspath(project_dir),
        "start_time": datetime.datetime.now().isoformat()
    }))
    
    try:
        asyncio.run(watch_and_collect(api_url, api_key, project_dir))
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
