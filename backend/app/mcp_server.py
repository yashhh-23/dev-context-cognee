import os
import sys
import tempfile
import traceback
import filelock
import difflib
import cognee
from pathlib import Path
from fastmcp import FastMCP

# Add backend directory to sys.path to allow absolute imports of app
backend_dir = Path(__file__).resolve().parent.parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

os.environ["COGNEE_SYSTEM_PATH"] = os.path.expanduser("~/.cognee_system")

from app.core.cognee_client import init_cognee
from app.cognee_utils import is_duplicate
from app.services.recall_service import extract_text

# Use a cross-platform temp file lock to protect Cognee initialization
lock_path = os.path.join(tempfile.gettempdir(), "cognee_kuzu.lock")
COGNEE_LOCK = filelock.FileLock(lock_path, timeout=10)

with COGNEE_LOCK:
    init_cognee()

# Create FastMCP server
mcp = FastMCP("dev-context-cognee")

@mcp.tool()
async def remember_context(text: str) -> str:
    """Store text, notes, or terminal logs into Cognee's persistent memory."""
    try:
        # Check for duplicates first to save database space
        dup = False
        existing = ""
        try:
            # Use 0.85 threshold to match duplicate criteria
            dup, existing = await is_duplicate(text, threshold=0.85)
        except Exception as e:
            print("[DEBUG] is_duplicate exception:", e)

        if dup or (existing and text.strip().lower() == existing.strip().lower()):
            return f"[DEDUP] Skipped - near-identical memory already exists. Existing: {existing[:100]}..."

        # Search for potentially contradicting existing memories
        contradictions = []
        try:
            results = await cognee.recall(text)
            if results:
                items = results if isinstance(results, list) else [results]
                for item in items:
                    existing_text = extract_text(item)
                    if not existing_text:
                        continue
                    similarity = difflib.SequenceMatcher(None, text.strip().lower(), existing_text.strip().lower()).ratio()
                    # High structural similarity but different semantic value represents a conflict
                    if 0.30 <= similarity < 0.85 and existing_text.strip().lower() != text.strip().lower():
                        contradictions.append(existing_text[:100])
        except Exception as e:
            print("[DEBUG] search exception:", e)

        await cognee.remember(text)

        if contradictions:
            return f"Stored. [WARNING] Potential conflict with: {contradictions[0]}"
        return "Successfully stored text in Cognee memory."
    except Exception as e:
        traceback.print_exc()
        return f"Error storing memory: {str(e)}"

@mcp.tool()
async def recall_context(query: str) -> str:
    """Query and recall relevant context from Cognee's memory."""
    try:
        raw = await cognee.recall(query)
        if not raw:
            return "No relevant context found."
        
        if isinstance(raw, list):
            items = [extract_text(item) for item in raw]
            return "\n\n".join(f"- {item}" for item in items if item)
        
        return extract_text(raw)
    except Exception as e:
        return f"Error recalling memory: {str(e)}"

@mcp.tool()
async def forget_context(node_id: str) -> str:
    """Prune or remove outdated memory nodes or datasets from Cognee."""
    try:
        # cognee.forget can accept dataset_name or node_id depending on version
        await cognee.forget(node_id)
        return f"Successfully requested forgetting for: {node_id}"
    except Exception as e:
        return f"Error forgetting memory: {str(e)}"

@mcp.tool()
async def cognify_source_code(file_path: str, content: str) -> str:
    """Index source code changes into the Cognee knowledge graph."""
    try:
        safe_file_id = file_path.replace(".", "_").replace(" ", "_")
        formatted_content = f"File Path: {safe_file_id}\nContent:\n{content}"

        # Dedup check before ingestion
        dup, existing = await is_duplicate(formatted_content)
        if dup:
            return f"[DEDUP] Skipped - near-identical content already in graph. Existing: {existing[:100]}..."

        # Add the code content to the workspace dataset
        clean_dataset_name = "workspacedata"
        await cognee.add(formatted_content, dataset_name=clean_dataset_name)
        # Run cognify to build the graph nodes and relations
        await cognee.cognify()
        return f"Successfully cognified source code for {file_path}."
    except Exception as e:
        return f"Error cognifying source code: {str(e)}"

if __name__ == "__main__":
    mcp.run()

