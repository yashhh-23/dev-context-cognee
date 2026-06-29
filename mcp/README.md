# dev-context-cognee MCP Server

This directory exposes a stdio-based MCP (Model Context Protocol) server powered by **Cognee** and **FastMCP**.

## Installation

Run the configuration generator script to print the correct JSON snippet for your IDE configuration:

### On Windows, macOS, or Linux:
```bash
python mcp/install.py
```

### On Bash environments (macOS/Linux/Git Bash):
```bash
chmod +x mcp/install.sh
./mcp/install.sh
```

---

## IDE Setup Instructions

### 1. Claude Desktop
Add the printed JSON block to your Claude Desktop config file:
- **Windows:** `%APPDATA%\Claude\claude_desktop_config.json`
- **macOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`

### 2. Cursor
To add the server to Cursor:
1. Open Cursor and navigate to **Settings** -> **Features** -> **MCP**.
2. Click **+ Add New MCP Server**.
3. Fill out the details:
   - **Name:** `dev-context-cognee`
   - **Type:** `command`
   - **Command:** The path to your virtual environment's python executable:
     - Windows: `<REPO_ROOT>\backend\venv\Scripts\python.exe`
     - macOS/Linux: `<REPO_ROOT>/backend/venv/bin/python`
   - **Arguments:** `"<REPO_ROOT>/mcp/server.py"`

### 3. Codex
Add the following to your Codex configuration file `~/.codex/config.toml`:
```toml
[mcp_servers.dev-context-cognee]
command = "/absolute/path/to/dev-context-cognee/backend/venv/Scripts/python.exe"
args = ["/absolute/path/to/dev-context-cognee/mcp/server.py"]
```
