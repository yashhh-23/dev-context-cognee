# dev·context — AI Memory for Developer Workflows

> Built for the **WeMakeDevs × Cognee Hackathon**. Cognee powers every memory operation: ingest, recall, forget, and draft.

[![Stack](https://img.shields.io/badge/stack-FastAPI%20%2B%20Cognee%20%2B%20VS%20Code-teal)](#)
[![Python](https://img.shields.io/badge/python-3.10%2B-blue)](#)
[![License](https://img.shields.io/badge/license-MIT-green)](#)

dev·context is a full-stack developer context engine that captures your coding sessions, ingests them into Cognee's knowledge graph, and surfaces relevant memory exactly when you need it — across debugging, bug triage, and open-source contribution.

## 🚀 One-Click Quick Start (Local Demo)

To boot the entire persistent-memory developer context engine with seeded mock data, run these two commands in your terminal:

```bash
cp .env.example .env
docker compose up --build
```

> [!IMPORTANT]
> Please ensure you populate the `NEXTAUTH_SECRET` and `DASHBOARD_PASSWORD` inside your new `.env` file, as our production-grade security middleware will explicitly block runtime execution if they are missing.

---

## What it does

| Workflow | How Cognee is used |
|---|---|
| **Save context** | Active file + symbols → `cognee.add()` + `cognee.cognify()` |
| **Recall similar bugs** | Code snippet → `cognee.search(SIMILARITY)` returns related past sessions |
| **Draft GitHub issue** | Snippet + error → Cognee recall + `cognee.llm_query()` → structured issue body |
| **Memory graph** | Visual knowledge graph of files, functions, bugs, sessions via `cognee.get_graph()` |
| **Forget** | Remove any memory node on demand via `cognee.delete()` |
| **Live stream** | WebSocket pushes Cognee memory events (stored, recalled, forgotten) in real time |

---

## Architecture

```text
┌──────────────────────────────────────────────────┐
│  Input Layer                                     │
│  VS Code Extension (sidebar + keybindings)       │
│  CLI  →  python cli/cognee_cli.py                │
└─────────────────────┬────────────────────────────┘
                      │  HTTP / WebSocket
┌─────────────────────┴────────────────────────────┐
│  FastAPI Backend  (backend/)                     │
│                                                  │
│  POST /api/ingest         → cognee.add/cognify   │
│  POST /api/recall         → cognee.search()      │
│  POST /api/bugs/draft-issue → bug_service.py     │
│  GET  /api/graph/query    → cognee.get_graph()   │
│  GET  /api/overview       → stats + KPIs         │
│  POST /api/memory/forget  → cognee.delete()      │
│  WS   /ws                 → live event stream    │
│                                                  │
│  services/  ingest_service  recall_service       │
│             bug_service (Cognee + LLM draft)     │
└─────────────────────┬────────────────────────────┘
                      │
          ┌───────────┴───────────┐
          │                       │
┌─────────┴─────────┐  ┌─────────┴──────────┐
│  Cognee Core      │  │  Next.js Dashboard  │
│  Knowledge Graph  │  │  /overview  KPIs    │
│  Vector Store     │  │  /bugs      Recall  │
│  LLM layer        │  │  /graph     Vis.js  │
└───────────────────┘  └────────────────────┘
```

---

## Project Structure

```text
dev-context-cognee/
├── backend/
│   ├── app/
│   │   ├── main.py                  # FastAPI app, all routers registered
│   │   ├── cognee_utils.py          # remember/recall/forget/memify wrappers
│   │   ├── file_watcher.py          # watchdog-based auto-ingest on file save
│   │   ├── mcp_server.py            # MCP tool server (Cognee recall as MCP tool)
│   │   ├── api/                     # Route handlers
│   │   │   ├── ingest.py
│   │   │   ├── recall.py
│   │   │   ├── bugs.py
│   │   │   ├── sessions.py
│   │   │   ├── context.py
│   │   │   ├── graph.py
│   │   │   ├── stats.py
│   │   │   ├── lifecycle.py
│   │   │   ├── contribute.py
│   │   │   └── ws.py
│   │   ├── services/
│   │   │   ├── ingest_service.py
│   │   │   ├── recall_service.py
│   │   │   └── bug_service.py       # Cognee recall + LLM → GitHub issue draft
│   │   ├── models/
│   │   │   ├── ingest.py
│   │   │   └── session.py
│   │   └── core/
│   │       ├── cognee_client.py     # init_cognee() + provider config
│   │       ├── config.py            # pydantic-settings config
│   │       ├── database.py          # SQLAlchemy engine + Base
│   │       ├── graph_builder.py
│   │       ├── github_utils.py
│   │       └── ws_manager.py
│   ├── Dockerfile
│   ├── requirements.txt
│   └── .env.example
├── extension/
│   ├── src/
│   │   ├── extension.ts             # activate() entry point
│   │   ├── provider.ts              # Sidebar WebView (full UI)
│   │   ├── commands/
│   │   │   ├── rememberContext.ts
│   │   │   ├── recallBugs.ts
│   │   │   └── draftIssue.ts
│   │   └── utils/
│   │       ├── apiClient.ts         # HTTP client with retry + 401 handling
│   │       ├── languageDetector.ts  # VS Code languageId → parse profile
│   │       └── tokenManager.ts      # SecretStorage read/write for API key
│   └── package.json
├── frontend/                        # Next.js dashboard
├── cli/
│   └── cognee_cli.py               # stdin → Cognee ingestion
├── mcp/                             # MCP server module
└── docker-compose.yml
```

---

## Quick Start

### Option A — Docker (recommended for demo)

```bash
git clone https://github.com/yashhh-23/dev-context-cognee.git
cd dev-context-cognee
cp backend/.env.example backend/.env
# Fill in your keys (see Environment Variables section below)
docker-compose up --build
```

| Service | URL |
|---|---|
| API + docs | http://localhost:8000/docs |
| Dashboard  | http://localhost:3000 |
| WebSocket  | ws://localhost:8000/ws |

### Option B — Manual

```bash
git clone https://github.com/yashhh-23/dev-context-cognee.git
cd dev-context-cognee
```

**For macOS / Linux:**
```bash
cp backend/.env.example backend/.env
python3 -m venv venv
source venv/bin/activate
```

**For Windows (CMD/PowerShell):**
```cmd
copy backend\.env.example backend\.env
python -m venv venv
venv\Scripts\activate
```

```bash
# 1. Backend
cd backend
pip install -r requirements.txt
cd ..
# Install the CLI client globally (editable mode)
pip install -e .
cd backend
uvicorn app.main:app --reload --port 8000

# 2. Frontend (separate terminal)
cd frontend
npm install
npm run dev                 # runs on http://localhost:3000
```

### VS Code Extension

```bash
cd extension
npm install
npm run compile
# In VS Code: press F5 to launch Extension Development Host
# Or package it: npm run package → installs the generated .vsix
```

On first use, run **Dev-Context: Set Cognee API Key** from the Command Palette (`Cmd/Ctrl+Shift+P`). The key is stored in VS Code SecretStorage — never in plain settings.

### MCP (Model Context Protocol) Server

To register Cognee memory tools with Claude Desktop, Cursor, or Cline:

```bash
# Run the auto-installer to register the MCP server with Claude Desktop
python mcp/install.py
```

For detailed configurations, see the `./mcp/README.md` guide.

---

## Environment Variables

Copy `backend/.env.example` to `backend/.env` and fill in the values below.

```env
# ── LLM Provider (required) ────────────────────────────────────────────────
GEMINI_API_KEY=your_gemini_key_here  # Primary LLM provider
GROQ_API_KEY=your_groq_key_here      # Fallback provider

# ── Cognee config (required) ───────────────────────────────────────────────
# LLM configuration is handled automatically in the backend. 
# It uses gemini-2.5-flash by default and falls back to llama-3.1-8b-instant.
COGNEE_VECTOR_DB_PROVIDER=lancedb # lancedb (zero-config local) | qdrant | weaviate
COGNEE_DB_PATH=./cognee_db        # local path for LanceDB + SQLite storage

# ── GitHub integration (required for /api/bugs and /api/contribute) ────────
GITHUB_TOKEN=ghp_...              # Personal access token, repo scope
GITHUB_REPO=owner/repo            # e.g. yashhh-23/dev-context-cognee

# ── App settings ───────────────────────────────────────────────────────────
PROJECT_NAME=dev-context-cognee
DATABASE_URL=sqlite:///./dev_context.db   # SQLite default; swap for postgres in prod
SECRET_KEY=change-me-in-production        # used for any signed tokens

# ── Frontend URLs (used by Next.js dashboard) ──────────────────────────────
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_WS_URL=ws://localhost:8000/ws
```

> **Minimum to get running:** `GEMINI_API_KEY`, `COGNEE_VECTOR_DB_PROVIDER`.
> GitHub vars are only needed for bug-recall and contribute routes.

---

## Cognee Memory Lifecycle

```text
Capture  →  cognee.add()        store raw context (file + symbols)
         →  cognee.cognify()    build knowledge graph (async, background)

Query    →  cognee.search()     vector + graph recall by similarity
         →  cognee.get_graph()  full node/edge map for visualisation

Manage   →  cognee.delete()     forget a specific memory node
         →  cognee.add()        memify — store manual note/context
         →  cognee.llm_query()  LLM call through Cognee's configured provider
```

---

## Keybindings (VS Code Extension)

| Action | Mac | Windows/Linux |
|---|---|---|
| Save current context | `Cmd+Shift+M` | `Ctrl+Shift+M` |
| Recall similar bugs | `Cmd+Shift+R` | `Ctrl+Shift+R` |
| Draft GitHub issue  | `Cmd+Shift+I` | `Ctrl+Shift+I` |

---

*Built with [Cognee](https://github.com/topoteretes/cognee) — memory infrastructure for AI.*