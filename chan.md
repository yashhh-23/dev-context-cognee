***

## Feature 1: Contradiction / Dedup Layer

Your `mcp_server.py` currently calls `cognee.add()` + `cognee.cognify()` blindly on every file change. You need to check for semantic duplicates **before** ingestion.

**Where to add it:** `backend/app/cognee_utils.py` (new helper) + called inside `cognify_source_code` in `mcp_server.py`.

### Step 1 — Add `dedup_check` to `cognee_utils.py`

```python
# backend/app/cognee_utils.py  (add this function)
import cognee
from difflib import SequenceMatcher

async def is_duplicate(new_text: str, threshold: float = 0.85) -> tuple[bool, str]:
    """
    Check if semantically similar content already exists in Cognee.
    Returns (is_dup, existing_content_snippet).
    """
    try:
        results = await cognee.search(new_text, query_type="CHUNKS")
        if not results:
            return False, ""
        # results is a list of ScoredResult or dicts with .score or ['score']
        for item in results:
            score = item.score if hasattr(item, "score") else item.get("score", 0)
            if score >= threshold:
                text = item.text if hasattr(item, "text") else item.get("text", "")
                return True, text[:200]
        return False, ""
    except Exception:
        return False, ""
```


### Step 2 — Gate ingestion in `mcp_server.py`

Your current `cognify_source_code` just blindly adds. Change it to:

```python
# backend/app/mcp_server.py — update cognify_source_code
from app.cognee_utils import is_duplicate

@mcp.tool()
async def cognify_source_code(file_path: str, content: str) -> str:
    """Index source code changes into the Cognee knowledge graph."""
    try:
        formatted_content = f"File Path: {file_path}\nContent:\n{content}"
        
        # ── Dedup check before ingestion ──
        dup, existing = await is_duplicate(formatted_content)
        if dup:
            return f"[DEDUP] Skipped — near-identical content already in graph. Existing: {existing[:100]}..."
        
        clean_dataset_name = "workspacedata"
        await cognee.add(formatted_content, dataset_name=clean_dataset_name)
        await cognee.cognify()
        return f"Successfully cognified source code for {file_path}."
    except Exception as e:
        return f"Error cognifying source code: {str(e)}"
```


### Step 3 — Add `contradiction_check` for `remember_context`

```python
# backend/app/mcp_server.py — update remember_context
@mcp.tool()
async def remember_context(text: str) -> str:
    """Store text, notes, or terminal logs into Cognee's persistent memory."""
    try:
        # Search for potentially contradicting existing memories
        results = await cognee.search(text, query_type="CHUNKS")
        contradictions = []
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
```


### Step 4 — Surface conflicts in the `/recall` dashboard page

Add a `conflicts` field to your `/api/recall` FastAPI route response so the frontend `/recall` page can show a ⚠️ badge — mirrors exactly what Imprint does in their dashboard.

***

## Feature 2: Multi-IDE MCP Server (Cursor, Claude Code, Codex)

Your `mcp_server.py` already uses `FastMCP` with `mcp.run()` which runs as a **stdio MCP server** — it's already compatible with every MCP-capable IDE. You just need config files and docs. Zero new Python code required.

### Step 1 — Expose an `mcp/` install directory

Create `mcp/` at repo root (mirroring Imprint's structure):

```
mcp/
├── server.py        # symlink or copy of backend/app/mcp_server.py
├── install.sh       # auto-configure script
└── README.md        # per-IDE setup instructions
```

**`mcp/server.py`** — a thin runner so users don't need to navigate `backend/app/`:

```python
# mcp/server.py
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "backend"))
from app.mcp_server import mcp

if __name__ == "__main__":
    mcp.run()
```


### Step 2 — Create per-IDE config files

**Claude Code** (`~/.claude.json` addition):

```json
{
  "mcpServers": {
    "dev-context-cognee": {
      "command": "python",
      "args": ["/absolute/path/to/dev-context-cognee/mcp/server.py"],
      "env": { "GROQ_API_KEY": "your-key", "GITHUB_TOKEN": "your-token" }
    }
  }
}
```

**Cursor** (`~/.cursor/mcp.json`):

```json
{
  "mcpServers": {
    "dev-context-cognee": {
      "command": "python",
      "args": ["/absolute/path/to/dev-context-cognee/mcp/server.py"]
    }
  }
}
```

**Codex** (`~/.codex/config.toml`):

```toml
[mcp_servers.dev-context-cognee]
command = "python"
args = ["/absolute/path/to/dev-context-cognee/mcp/server.py"]
```

Add these as committed files in `mcp/configs/` so judges can copy-paste.

### Step 3 — Add `AGENTS.md` at repo root

Imprint ships this for every AI coding agent to auto-discover the MCP tools. Create `AGENTS.md`:

```markdown
# dev-context-cognee MCP Tools

At session start, call `recall_context` with the user's first message.
Call `remember_context` whenever a debug session completes or a bug is resolved.
Call `cognify_source_code` after significant file edits.
Call `forget_context` to prune stale nodes on user request.
```


***