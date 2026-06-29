import asyncio
import os
import sys
from pathlib import Path
from watchfiles import awatch, Change

# Add backend directory to sys.path to allow absolute imports of app
backend_dir = Path(__file__).resolve().parent.parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

from app.mcp_server import cognify_source_code

# The workspace root is two levels up from backend/app
WORKSPACE_ROOT = Path(__file__).resolve().parent.parent.parent

# Excluded directory names
EXCLUDED_DIRS = {
    ".git",
    ".venv",
    "node_modules",
    "__pycache__",
    ".next",
    "dist",
    "build"
}

# Excluded file extensions
EXCLUDED_EXTENSIONS = {
    ".exe",
    ".dll",
    ".pdb",
    ".pyc",
    ".db",
    ".log",
    ".png",
    ".jpg",
    ".svg",
    ".webp",
    ".gif",
    ".ico"
}

def should_process(file_path_str: str) -> bool:
    """Determine if a file should be indexed by checking its path and extension."""
    path = Path(file_path_str)
    
    # Exclude if any part of the path is in the excluded directories
    for part in path.parts:
        if part in EXCLUDED_DIRS:
            return False
            
    # Exclude by suffix
    if path.suffix.lower() in EXCLUDED_EXTENSIONS:
        return False
        
    # Extra protection against SQLite database files or locks
    if "dev_context" in path.name or path.name.endswith(".db") or path.name.endswith(".db-journal"):
        return False
        
    return True

async def watch_workspace():
    print(f"[Watcher] Initializing file watcher on workspace root: {WORKSPACE_ROOT}")
    
    async for changes in awatch(WORKSPACE_ROOT):
        for change_type, file_path_str in changes:
            if change_type in (Change.added, Change.modified):
                if not should_process(file_path_str):
                    continue
                
                file_path = Path(file_path_str)
                try:
                    relative_path = file_path.relative_to(WORKSPACE_ROOT)
                except ValueError:
                    relative_path = file_path
                
                print(f"[Watcher] Change detected: {change_type.name} -> {relative_path}")
                
                try:
                    if file_path.is_file():
                        # Read content safely with UTF-8, ignoring decoding errors for binary remnants
                        with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
                            content = f.read()
                        
                        safe_path_str = str(relative_path).replace(".", "_").replace(" ", "_")
                        print(f"[Watcher] Indexing change in {relative_path} (as {safe_path_str}) into Cognee...")
                        result = await cognify_source_code(safe_path_str, content)
                        print(f"[Watcher] Indexing complete: {result}")
                except Exception as e:
                    print(f"[Watcher] Failed to process change for {relative_path}: {str(e)}")

if __name__ == "__main__":
    try:
        asyncio.run(watch_workspace())
    except KeyboardInterrupt:
        print("[Watcher] Terminated by user.")
