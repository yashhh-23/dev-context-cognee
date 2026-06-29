import os
import sys
from pathlib import Path

# Add backend directory to sys.path to allow absolute imports of app
backend_dir = Path(__file__).resolve().parent.parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

import os
import tempfile
import filelock
import cognee
from fastmcp import FastMCP
from app.core.cognee_client import init_cognee

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
        # Search for potentially contradicting existing memories
        results = await cognee.search(text, query_type="SUMMARIES")
        contradictions = []
        if results:
            for item in results:
                score = item.score if hasattr(item, "score") else item.get("score", 0)
                existing = item.text if hasattr(item, "text") else item.get("text", "")
                if score > 0.75:  # high similarity = possible contradiction
                    contradictions.append(existing[:100])

        await cognee.remember(text)

        if contradictions:
            return f"Stored. ⚠️ Potential conflict with: {contradictions[0]}"
        return "Successfully stored text in Cognee memory."
    except Exception as e:
        return f"Error storing memory: {str(e)}"

@mcp.tool()
async def recall_context(query: str) -> str:
    """Query and recall relevant context from Cognee's memory."""
    try:
        raw = await cognee.recall(query)
        from app.services.recall_service import extract_text
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
        from app.cognee_utils import is_duplicate
        dup, existing = await is_duplicate(formatted_content)
        if dup:
            return f"[DEDUP] Skipped — near-identical content already in graph. Existing: {existing[:100]}..."

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
