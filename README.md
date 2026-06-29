# dev·context — AI Memory for Developer Workflows

> Built for the **WeMakeDevs × Cognee Hackathon**. Cognee powers every memory operation.

[![Branch](https://img.shields.io/badge/branch-feature%2Fdashboard--v2-teal)](#)
[![Stack](https://img.shields.io/badge/stack-FastAPI%20%2B%20Next.js%20%2B%20Cognee-blue)](#)

dev·context is a full-stack developer context engine that captures your coding sessions, ingests them into Cognee’s knowledge graph, and surfaces relevant memory exactly when you need it — across debugging, bug triage, and open-source contribution.

---

## What it does

| Workflow | How Cognee is used |
|---|---|
| **Debug session capture** | Terminal output + file context → `cognee.add()` + `cognee.cognify()` |
| **Bug recall** | Select a GitHub issue → `cognee.search()` returns related past sessions |
| **Contribute suggestions** | Good-first issues → Cognee graph traversal suggests relevant code entry points |
| **Memory graph** | Visual knowledge graph of files, functions, bugs, and sessions via `cognee.get_graph()` |
| **Recall search** | Free-text search over all stored context with forget + memify actions |
| **Live stream** | WebSocket pushes Cognee memory events (stored, recalled, forgotten) in real time |

---

## Architecture

```
┌─────────────────────────────────────────────────────┐
│  Input Layer                                    │
│  VS Code Extension  ┌───┐  CLI (stdin pipe)     │
│  cognee.sendToMemory └───┘  python cli/cognee_cli.py │
└─────────────────┬───────────────────────────┘
                       │
┌─────────────────┴───────────────────────────┐
│  FastAPI Backend  (backend/)                    │
│                                                 │
│  /api/bugs          → GitHub Issues API          │
│  /api/contribute    → Good-first-issue finder    │
│  /api/graph/build   → cognee.cognify()           │
│  /api/graph/query   → cognee.get_graph()         │
│  /api/recall        → cognee.search()            │
│  /api/recall/memify → cognee.add() + cognify()   │
│  /ws                → WebSocket event stream     │
│                                                 │
│  cognee_utils.py: remember / recall /           │
│                   forget / memify wrappers      │
└─────────────────┬───────────────────────────┘
                       │
          ┌──────────┴──────────┐
          │                       │
┌─────────┴───────┐ ┌─────────┴────────┐
│  Cognee Core        │ │  Next.js Dashboard    │
│                    │ │                      │
│  Knowledge Graph   │ │  /overview  → KPIs   │
│  Vector Store      │ │  /bugs      → Recall  │
│  Graph DB          │ │  /contribute→ Suggest │
│  (Postgres/Neo4j)  │ │  /graph     → Vis.js  │
└────────────────────┘ │  /recall    → Search  │
                       └──────────────────────┘
```

---

## Quick Start

### 1. Clone & set environment variables

```bash
git clone https://github.com/yashhh-23/dev-context-cognee.git
cd dev-context-cognee
cp .env.example .env
```

Required env vars:

```env
COGNEE_LLM_PROVIDER=openai          # or anthropic, local
COGNEE_LLM_MODEL=gpt-4o-mini
COGNEE_VECTOR_DB_PROVIDER=lancedb   # zero-config local option
GITHUB_TOKEN=ghp_...                # for bug + contribute routes
GITHUB_REPO=owner/repo              # target repo to analyze
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_WS_URL=ws://localhost:8000/ws
```

### 2. Start with Docker (recommended)

```bash
docker-compose up --build
```

| Service | URL |
|---|---|
| Dashboard | http://localhost:3000 |
| API docs  | http://localhost:8000/docs |
| WebSocket | ws://localhost:8000/ws |

### 3. Start manually

```bash
# Backend
cd backend
pip install -r requirements.txt
uvicorn main:app --reload --port 8000

# Frontend
cd frontend
npm install
npm run dev
```

### 4. Ingest your first context

```bash
# Via CLI (pipe any output)
echo "Fixed auth bug — missing await in middleware.ts:42" | python cli/cognee_cli.py

# Via VS Code
# Cmd/Ctrl+Shift+P → "Cognee: Send to Memory"
```

---

## Dashboard Pages

| Route | Description |
|---|---|
| `/overview` | KPI cards, 7-day bug trend chart, recent sessions, live memory event stream |
| `/bugs` | GitHub issues with severity badges, Cognee recall per bug |
| `/contribute` | Good-first-issues and stale PRs with Cognee-suggested entry points |
| `/graph` | Interactive vis.js knowledge graph of all Cognee memory nodes |
| `/recall` | Free-text search, per-node forget, and manual memify panel |

---

## Cognee Memory Lifecycle

```
Capture → cognee.add()      # store raw context
         → cognee.cognify()  # build knowledge graph (async)

Query   → cognee.search()   # vector + graph recall
         → cognee.get_graph() # full node/edge map

Manage  → forget()           # remove a node
         → memify()           # store manual context
         → improve()          # triggered on session end
```

---

## Project Structure

```
dev-context-cognee/
├── backend/
│   ├── main.py              # FastAPI app + WebSocket
│   ├── cognee_utils.py      # remember/recall/forget/memify wrappers
│   ├── websocket.py         # WS manager + event broadcast
│   └── routes/
│       ├── bugs.py            # GitHub Issues + severity tagging
│       ├── contribute.py      # Good-first-issue + stale PR finder
│       ├── graph.py           # Cognee graph build + query
│       └── recall.py          # Vector search + forget + memify
├── frontend/
│   └── src/
│       ├── app/               # Next.js App Router pages
│       ├── components/
│       │   ├── layout/        # DashboardShell, Sidebar, Topbar
│       │   └── ui/            # LiveFeed, BugTrendChart
│       └── lib/
│           ├── api.ts         # Typed API client
│           └── ws.ts          # WebSocket singleton + reconnect
├── cli/
│   └── cognee_cli.py        # stdin → Cognee ingestion
├── extension/             # VS Code extension
└── docker-compose.yml
```

---

## Demo Script (3-minute video)

1. **Open `/overview`** — show KPI cards loading, live memory stream ticking
2. **Open `/bugs`** — click a bug, watch Cognee recall surface related session context
3. **Open `/contribute`** — hit “cognee recall” on a good-first-issue, show AI suggestion
4. **Open `/graph`** — hit “rebuild graph”, watch nodes/edges appear live
5. **Open `/recall`** — type a query, show results, forget one node, memify a new note
6. **Show the VS Code extension** sending context to memory in one command

---

## Open-Source Contribution Targets

This project was built to demonstrate deep Cognee integration. Meaningful PR opportunities:

- **LangGraph integration**: Wire Cognee memory into a LangGraph agent loop for multi-step debugging
- **n8n node**: Cognee memory node for n8n automation workflows  
- **MCP server**: Expose Cognee recall as an MCP tool for Claude/Cursor
- **Cognee docs**: Add dev-context as an example in the Cognee cookbook

---

*Built with [Cognee](https://github.com/topoteretes/cognee) — memory infrastructure for AI.*


