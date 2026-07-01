# DevContext Assistant — Production PRD

**Document Version:** 2.0.0  
**Author:** Shubham Pawar  
**Project Type:** Hackathon → Major Project (WeMakeDevs × Cognee / Google I/O Connect Bengaluru)  
**Hackathon Theme:** "The Hangover Part AI: Where's My Context?"  
**Status:** Pre-development  
**Last Updated:** June 22, 2026  
**Changelog:** v2.0.0 — Integrated CLI platform, MCP Server architecture, Next.js dashboard, smart ingestion logic, two-step GitHub retrieval, updated monorepo structure, Functional Cyberpunk aesthetic, revised phase plan and test strategy.

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Problem Statement](#2-problem-statement)
3. [Solution Overview](#3-solution-overview)
4. [Goals & Success Metrics](#4-goals--success-metrics)
5. [User Personas](#5-user-personas)
6. [Feature Specification](#6-feature-specification)
7. [Tech Stack](#7-tech-stack)
8. [System Architecture](#8-system-architecture)
9. [File Structure](#9-file-structure)
10. [Data Models](#10-data-models)
11. [API Contract](#11-api-contract)
12. [Reasoning on Key Implementation Decisions](#12-reasoning-on-key-implementation-decisions)
13. [Implementation Plan — Phases](#13-implementation-plan--phases)
14. [Testing Strategy](#14-testing-strategy)
15. [Non-Functional Requirements](#15-non-functional-requirements)
16. [Security & Privacy](#16-security--privacy)
17. [Risks & Mitigations](#17-risks--mitigations)
18. [Open Questions](#18-open-questions)
19. [Glossary](#19-glossary)

---

## 1. Executive Summary

DevContext Assistant is a **persistent developer memory layer** built on Cognee's hybrid graph-vector store, exposed to the world through a **Model Context Protocol (MCP) Server**. It ingests VS Code terminal outputs, Git states, and dependency manifests across sessions, persists them as a queryable knowledge graph, and delivers two core capabilities:

- **Inward Memory:** Instant recall of past debug sessions, dependency conflicts, and project states so developers never re-investigate the same bug twice.
- **Outward Intelligence:** A GitHub-connected "OSS Radar" that semantically matches the developer's local fixes against public issues, surfaces identical bugs in OSS repos, and enables direct PR/issue drafting — turning every personal fix into a potential community contribution.

The product ships as **three coordinated surfaces** unified by a "Functional Cyberpunk" aesthetic — all driven by one MCP Server brain:

| Surface | Role | Primary User |
|---|---|---|
| VS Code Extension | Passive observer + immediate interaction | All developers |
| Web Dashboard (Next.js) | Visual exploration + deep-dive analysis | Project retrospectives, demos |
| CLI | Lightweight terminal-native bridge | Linux power users, Neovim devs |

All three clients connect to the same MCP Server over stdio or HTTP, ensuring the memory layer is **fully decoupled from the UI**.

---

## 2. Problem Statement

### The Core Pain

Every developer loses hours to **repetitive troubleshooting**. A dependency conflict fixed on Tuesday is re-investigated on Thursday because the terminal session closed. A Gradle duplicate-class error that took 90 minutes to resolve gets forgotten within a week. Context lives in browser tabs, Slack messages, and fragmented commit messages — not in a queryable system.

### Why Existing Tools Fail

| Tool | Why It Fails |
|---|---|
| Git history | Records *what* changed, not *why* or *how* it was fixed |
| Browser bookmarks | Manual, unstructured, not queryable by error message |
| Notion / Obsidian | Requires manual entry; no terminal integration |
| GitHub Copilot | Stateless per session; no cross-day memory |
| Stack Overflow | Public knowledge only; no personal debug history |

### The Compound Problem

Beyond personal memory, developers frequently fix bugs that **already exist as open issues in the OSS libraries they use** — and never know it. Their fix, which could help hundreds of other developers, never reaches the community. There is no bridge between a local `build.gradle` fix and a `google/android-ai-samples` open issue.

---

## 3. Solution Overview

```
┌──────────────────────────────────────────────────────────────────────┐
│                        DEVCONTEXT ASSISTANT                          │
│                                                                      │
│   CLIENT LAYER             MCP SERVER (BRAIN)       STORE LAYER     │
│   ────────────             ──────────────────       ───────────      │
│                            ┌──────────────────┐                     │
│   VS Code Extension ──────▶│  FastAPI +        │──▶ Cognee          │
│   Web Dashboard     ──────▶│  MCP Protocol     │    Hybrid Store    │
│   CLI               ──────▶│                   │    (Graph +        │
│                            │  remember_        │     Vector)        │
│                            │  terminal_output  │                     │
│                            │  recall_bug_graph │◀── GitHub API      │
│                            │  scan_oss_        │    (Issues +       │
│                            │  opportunities    │     Repos)         │
│                            └──────────────────┘                     │
└──────────────────────────────────────────────────────────────────────┘
```

### The Three Surfaces

**A. VS Code Extension — "The Action Center"**
- Silently monitors integrated terminal stderr; tracks active Git branch; parses `package.json` / `build.gradle` diffs
- Detects non-zero exit codes and captures stack traces automatically
- Sidebar WebView (Functional Cyberpunk aesthetic) lights up contextually when a recurring bug is detected or a contribution opportunity arises
- Connects to MCP Server via stdio

**B. Web Dashboard — "The Command Deck"**
- Built in Next.js (App Router) for rich server-side rendering and fast navigation
- Interactive force-directed graph visualisation of the Cognee knowledge graph
- Full "Contribute" tab with OSS Radar, similar bug cards, and PR/issue drafting
- Connects to MCP Server via HTTP

**C. CLI — "The Power User Bridge"**
- Lightweight terminal-native interface ideal for Linux/Neovim developers
- Commands: `devcontext recall "error signature"`, `devcontext log`, `devcontext improve`
- Returns fast, stdout-formatted graph traversals and resolution strategies
- Connects to MCP Server via stdio or HTTP

---

## 4. Goals & Success Metrics

### Hackathon Goals (June 29 – July 5 deadline)

| Goal | Metric |
|---|---|
| Cognee memory persists across 2+ sessions | Demo: recall previous session's bug without re-input |
| GitHub OSS matching works with real data | At least 1 real match from a real bug in demo |
| All three surfaces functional | VS Code sidebar + web dashboard + CLI all operational |
| All 4 Cognee lifecycle APIs demonstrated | `remember()`, `recall()`, `improve()`, `forget()` each shown |
| MCP Server decoupled from all clients | Any client can be replaced without touching the brain |

### Product Goals (Post-hackathon / Major Project)

| Goal | Metric | Target |
|---|---|---|
| Vector recall accuracy | % of correct fixes returned in top 2 results | > 95% (golden dataset) |
| Time saved per bug | Avg. minutes saved vs no-tool baseline | > 20 min |
| OSS match confidence | % of GitHub matches with similarity > 80% rated useful | > 60% |
| Extension adoption | Daily active sessions (university demo) | > 50 DAU |

---

## 5. User Personas

### Persona 1 — The Hackathon Dev (Primary)
- **Who:** Second/third-year CS student building projects for hackathons
- **Pain:** Loses debug context between overnight coding sessions
- **Goal:** Pick up exactly where they left off without re-reading 200 terminal lines
- **Usage:** VS Code Extension all day; Web Dashboard for project retrospectives

### Persona 2 — The Linux Power User (Secondary)
- **Who:** Developer on Arch Linux with a tiling WM + Neovim as primary editor
- **Pain:** GUI tools are too heavy; needs memory access from the terminal
- **Goal:** `devcontext recall "segfault mmap"` from any terminal, get results in stdout immediately
- **Usage:** CLI exclusively; never opens the web dashboard

### Persona 3 — The OSS Contributor (Secondary)
- **Who:** Developer who uses open-source libraries heavily and occasionally contributes
- **Pain:** Fixes bugs locally but never files issues or PRs because finding the right repo is friction
- **Goal:** Turn a personal fix into a community contribution in under 5 minutes
- **Usage:** Contribute tab on the Web Dashboard, triggered by an OSS Radar notification

### Persona 4 — The Team Lead (Tertiary, Post-hackathon)
- **Who:** Engineering lead on a small team (4–8 devs)
- **Pain:** Recurring bugs across team members that nobody tracks systematically
- **Goal:** Shared project memory so solutions aren't reinvented team-wide
- **Usage:** Web Dashboard with multi-user project context (Phase 5 scope)

---

## 6. Feature Specification

### F1 — Smart Terminal Ingestion

**Description:** The VS Code Extension monitors the active terminal. Unlike naive keyword matching, it implements **exit-code-aware capture**: it specifically captures execution blocks that exit with a non-zero status code, extracting the stack trace. It then waits for a subsequent execution of the same command that exits with a zero status code. The **delta in workspace files** between the failure and success states forms the "Fix Node," which is fed to the MCP Server's `remember_terminal_output` tool alongside the error trace.

**Trigger conditions:**
- Terminal command exits with non-zero status → error block captured
- Same command subsequently exits with zero status → fix delta computed
- User manually triggers via command palette (`DevContext: Log This`)
- On git commit (captures commit message + current bug state)

**What is captured per ingestion cycle:**

| Field | Source |
|---|---|
| `error_text` | stderr block from non-zero exit |
| `fix_delta` | Git diff of workspace files between failure and success |
| `error_type` | Classified by `ErrorPatternDetector` regex bank |
| `source_file` | Parsed from stacktrace |
| `dep_name` / `dep_version` | Parsed from `package.json` / `build.gradle` diff |
| `branch` / `commit_hash` | `git rev-parse` at time of capture |
| `project` | Workspace folder name |
| `timestamp` | ISO 8601 |

**Non-goals for F1:** Does not ingest stdout noise. Does not store secrets or `.env` content (stripped by `ErrorPatternDetector` before transmission).

---

### F2 — MCP Memory Engine

**Description:** The core intelligence is decoupled from all UIs and exposed as an **MCP Server**. Cognee is wrapped inside this server, which exposes three primary tools:

| MCP Tool | Purpose |
|---|---|
| `remember_terminal_output` | Ingests a structured bug + fix payload into Cognee |
| `recall_bug_graph` | Queries Cognee with natural language; returns ranked memory nodes |
| `scan_oss_opportunities` | Triggers GitHub search against a bug node; returns matched OSS issues |

All three clients (VS Code, Dashboard, CLI) connect to this server via standard IO or HTTP — never calling Cognee directly.

**Query examples `recall_bug_graph` must handle:**
- `"dependency conflict gradle"` → all past Gradle conflicts with fixes
- `"aicore sdk error"` → all AICore-related bug memories
- `"what was I debugging last night?"` → memories from last 12 hours
- `"how did I fix the kotlin duplicate class bug?"` → fix node specifically

---

### F3 — Memory Lifecycle Management

All four Cognee lifecycle APIs are used and exposed as distinct flows:

| Function | Trigger |
|---|---|
| `remember()` | On every new bug+fix ingestion cycle |
| `recall()` | On every developer query (any surface) |
| `improve()` | When developer marks a bug as resolved; updates fix node with resolution text |
| `forget()` | On project deletion or when a dep is removed; prunes orphaned nodes |

**Graph integrity requirement:** `forget()` must successfully prune **orphaned nodes** — dependency or fix nodes that become disconnected from any bug node after deletion. A graph integrity unit test verifies this.

---

### F4 — Memory Graph Visualisation

**Description:** The Web Dashboard renders an interactive force-directed graph of the developer's Cognee memory using `react-flow` or `d3.js`.

**Node types and colours (Functional Cyberpunk palette):**

| Type | Colour | Meaning |
|---|---|---|
| Bug | `#f85149` red | An unresolved or resolved error event |
| Dependency | `#d29922` yellow | A library/package involved in a bug |
| Fix | `#3fb950` green | The resolution applied |
| Project | `#58a6ff` blue | A workspace/repository scope |
| GitHub Issue | `#bc8cff` purple | A matched OSS issue |

**Interactions:** Hover → tooltip; Click → right panel detail; Filter by type via legend; Filter by project via dropdown.

---

### F5 — OSS Radar (GitHub Integration) — Two-Step Retrieval

**Description:** When a developer's fix is logged, the system asynchronously identifies if open-source projects are suffering from the same issue and surfaces actionable contribution paths.

**Two-step retrieval architecture (anti-hallucination design):**

**Step 1 — Lexical Search (GitHub REST API)**
- Uses `is:issue is:open` queries with vectorized keywords extracted from the local bug
- Narrows ~100 million repos down to the top 10 most relevant issues
- Fast, deterministic, low-cost

**Step 2 — Semantic Match (Cognee Graph)**
- Ingests the top 10 GitHub issue titles + bodies into the Cognee graph as `GitHubIssueNode` objects
- Cognee computes cosine similarity between the local `BugNode` embedding and each `GitHubIssueNode`
- Only nodes crossing the **80% confidence threshold** are surfaced in the Contribute tab
- Only at this stage are results passed to the LLM to draft a PR/issue summary

**Why two steps:** Relying strictly on LLM context windows to search GitHub is inefficient and prone to hallucination. Lexical search provides deterministic recall; semantic matching provides precision.

**Sub-feature F5a — Similar Bug Finder:**
- Shows open and recently-closed OSS issues matching the local bug
- Developer can: view the issue, post their fix as a comment, copy a formatted fix snippet, link the GitHub issue to their local memory node

**Sub-feature F5b — Contribution Opportunity Radar:**
- Identifies OSS repos where the same bug exists as an open `good first issue` or `help wanted` issue and no PR has been filed yet
- Developer can: fork the repo, draft a PR pre-filled with their fix context, or file a new issue

---

### F6 — VS Code Extension Sidebar

**Description:** TypeScript extension rendering a WebView panel with the Functional Cyberpunk aesthetic. Connects to MCP Server via stdio.

**Sidebar panels:**
- **Session** — current project, branch, active bug count
- **Quick Recall** — single-line query input, results inline
- **Bug Feed** — last 5 bugs ingested this session
- **Contribute Nudge** — banner when an OSS match > 80% confidence is found

**VS Code Commands registered:**
- `devcontext.logTerminal` — manually log selected terminal text
- `devcontext.recall` — open recall input
- `devcontext.markResolved` — mark latest bug as resolved
- `devcontext.openDashboard` — open web dashboard in browser

---

### F7 — CLI Interface

**Description:** A lightweight terminal-native interface for power users who prefer the terminal over a GUI. Connects to the MCP Server over stdio or HTTP.

**Commands:**

| Command | Description |
|---|---|
| `devcontext recall "error signature"` | Query memory; stdout-formatted results |
| `devcontext log` | Manually pipe terminal text into memory |
| `devcontext improve <bug_id>` | Mark bug as resolved with fix text |
| `devcontext forget <bug_id>` | Remove bug from memory |
| `devcontext contribute` | List current OSS Radar matches |
| `devcontext graph` | Print ASCII graph of recent memory nodes |

**Output format:** Plain text by default; `--json` flag for machine-readable output; `--no-color` for non-TTY environments.

**Implementation:** Node.js with Commander.js (consistent with the TypeScript monorepo) or Python with Typer. Decision to be made in Phase 1 based on MCP client library availability.

---

## 7. Tech Stack

### MCP Server / Backend (The Brain)

| Layer | Technology | Reason |
|---|---|---|
| Runtime | Python 3.11 | Cognee SDK is Python-native |
| Web framework | FastAPI | Async, OpenAPI docs, `BackgroundTasks` for async GitHub search |
| Protocol | MCP (Model Context Protocol) | Decouples brain from all UIs; standard tool definitions |
| Memory engine | Cognee (pinned version) | Core dependency — hybrid graph-vector, all 4 lifecycle APIs |
| Vector store | Cognee default (LanceDB) | Managed internally by Cognee |
| Graph store | Cognee default (NetworkX) | Managed internally by Cognee |
| GitHub client | PyGitHub + `httpx` | PyGitHub for auth; httpx for lexical search endpoints |
| Auth | GitHub OAuth 2.0 | Required for write operations (comment, PR draft) |
| Task queue | `asyncio` + FastAPI `BackgroundTasks` | Lightweight; GitHub search runs async post-ingestion |
| Testing | `pytest`, `pytest-httpx` | Unit + integration; httpx mock for GitHub rate limit QA |
| Deployment | Docker + HuggingFace Spaces (port 7860) | Consistent with prior project architecture |

### Web Dashboard (The Command Deck)

| Layer | Technology | Reason |
|---|---|---|
| Framework | Next.js 14 (App Router) | SSR for fast initial load; file-based routing; replaces plain React+Vite |
| Language | TypeScript | Type safety across API and graph data |
| Styling | TailwindCSS + CSS variables | Tailwind for layout; custom vars for Functional Cyberpunk palette |
| Graph visualisation | `react-flow` or `d3.js` | Force-directed graph for memory node explorer |
| Charts | `recharts` | Bug frequency bar charts |
| State management | Zustand | Lightweight; no Redux overhead |
| HTTP client | `axios` | Request/response interceptors for MCP HTTP calls |
| MCP client | `@modelcontextprotocol/sdk` (JS) | Official MCP client for Next.js ↔ MCP Server |
| Deployment | Vercel | Zero-config Next.js deploy |

### VS Code Extension (The Action Center)

| Layer | Technology | Reason |
|---|---|---|
| Language | TypeScript + Node.js | VS Code Extension API is TypeScript-native |
| Extension API | `vscode` module | Terminal access, WebView, commands, status bar |
| WebView | Compiled React/HTML injection | Functional Cyberpunk aesthetic; reuses ui-kit components |
| MCP client | stdio transport | Direct process communication with Python MCP Server |
| Testing | `@vscode/test-electron` | Headless VS Code for E2E extension testing |

### CLI (The Power User Bridge)

| Layer | Technology | Reason |
|---|---|---|
| Language | Node.js (TypeScript) | Consistent with monorepo; shares `types/` package |
| CLI framework | Commander.js | Lightweight, well-documented, battle-tested |
| MCP client | stdio / HTTP transport | Same MCP Server, different transport |
| Output | `chalk` + `cli-table3` | Coloured stdout; table formatting for graph output |

### Dev Tooling

| Tool | Purpose |
|---|---|
| `pnpm` + workspaces | Monorepo package management |
| `turbo` | Build orchestration across apps and packages |
| `eslint` + `prettier` | Code quality across all TypeScript packages |
| `husky` + `lint-staged` | Pre-commit hooks |
| Docker Compose | Local dev: MCP Server + Cognee store |
| `vitest` | Unit tests for dashboard + CLI |
| `playwright` | E2E tests for Next.js dashboard |
| `@vscode/test-electron` | Headless VS Code extension testing |

---

## 8. System Architecture

### Component Diagram

```
┌──────────────────────────────────────────────────────────────────────┐
│  DEVELOPER MACHINE                                                   │
│                                                                      │
│  ┌─────────────────┐  ┌──────────────────────┐  ┌────────────────┐   │
│  │  VS Code Ext.   │  │   Web Dashboard      │  │     CLI        │   │
│  │  (TypeScript)   │  │   (Next.js)          │  │ (Commander.js) │   │
│  │                 │  │                      │  │                │   │
│  │  Terminal Listen│  │  Overview / Bugs     │  │  recall        │   │
│  │  Sidebar WebView│  │  Memory Graph        │  │  log           │   │
│  │  MCP stdio      │  │  Contribute Tab      │  │  improve       │   │
│  └────────┬────────┘  │  MCP HTTP client     │  └───────┬────────┘   │
│           │ stdio     └──────────┬───────────┘  HTTP    │            │
│           │                     │ HTTP                  │            │
│           └─────────────────────┼───────────────────────┘            │
│                                 │                                    │
│              ┌──────────────────▼─────────────────────┐              │
│              │         MCP SERVER (The Brain)          │             │
│              │         FastAPI + Python 3.11           │             │
│              │                                         │             │
│              │  Tools:                                 │             │
│              │  • remember_terminal_output             │             │
│              │  • recall_bug_graph                     │             │
│              │  • scan_oss_opportunities               │             │
│              │                                         │             │
│              │  Routes: /ingest /recall /contribute    │             │
│              │          /graph  /improve /forget /auth │             │
│              └──────────┬────────────────┬────────────┘              │
│                         │                │                           │
│              ┌──────────▼──────┐  ┌──────▼──────────────┐            │
│              │   Cognee SDK    │  │   GitHub API         │           │
│              │                 │  │   (httpx + PyGitHub) │           │
│              │  remember()     │  │                      │           │
│              │  recall()       │  │  Step 1: Lexical     │           │
│              │  improve()      │  │    is:issue is:open  │           │
│              │  forget()       │  │  Step 2: Semantic    │           │
│              └──────┬──────────┘  │    cosine > 0.80     │           │
│                     │             └──────────────────────┘           │
│              ┌──────▼──────────────────────┐                         │
│              │   Cognee Hybrid Store        │                        │
│              │                              │                        │
│              │  Graph Layer (NetworkX)      │                        │
│              │  Vector Layer (LanceDB)      │                        │
│              │                              │                        │
│              │  Persisted to ~/.cognee/     │                        │
│              └──────────────────────────────┘                        │
└──────────────────────────────────────────────────────────────────────┘
```

### Request Flow — Smart Bug Ingestion

```
Terminal command exits with non-zero code
        │
        ▼
VS Code Extension: captures stderr block
        │
        ▼
VS Code Extension: waits for same command → zero exit code
        │
        ▼
Git diff computed: failure state → success state = Fix Delta
        │
        ▼
ErrorPatternDetector: classifies error type, strips secrets
        │
        ▼
MCP stdio call → remember_terminal_output(error, fix_delta, metadata)
        │
        ├─→ MCP Server → cognee.remember(payload) ──→ Cognee Store (sync)
        │
        └─→ BackgroundTask: scan_oss_opportunities(bug_id)
                   │
                   ▼
             Step 1: GitHub lexical search (top 10 issues)
                   │
                   ▼
             Step 2: Ingest issues into Cognee → cosine similarity
                   │
                   ▼
             Filter: similarity > 0.80
                   │
                   ▼
             LLM drafts PR/issue summary for high-confidence matches
                   │
                   ▼
             WebSocket push: "OSS match found"
```

### Request Flow — Recall (Any Surface)

```
Query: "how did I fix kotlin duplicate class?"
        │
        ├─ VS Code Extension → MCP stdio → recall_bug_graph(q)
        ├─ Web Dashboard     → HTTP GET /recall?q=...
        └─ CLI               → devcontext recall "kotlin duplicate class"
                                       │
                                       ▼
                              MCP Server → cognee.recall(q)
                              (vector similarity + graph traversal)
                                       │
                                       ▼
                              Ranked memory nodes → JSON
                                       │
                                       ▼
                              Surface-specific rendering
```

---

## 9. File Structure

```
devcontext-monorepo/
│
├── README.md
├── docker-compose.yml              # MCP Server + Cognee store
├── turbo.json                      # Turborepo build orchestration
├── pnpm-workspace.yaml
├── .env.example
│
├── apps/
│   │
│   ├── web-dashboard/              # Next.js 14 Frontend (The Command Deck)
│   │   ├── next.config.ts
│   │   ├── package.json
│   │   └── src/
│   │       ├── app/                # App Router pages
│   │       │   ├── layout.tsx
│   │       │   ├── page.tsx        # Overview
│   │       │   ├── bugs/
│   │       │   │   └── page.tsx
│   │       │   ├── graph/
│   │       │   │   └── page.tsx
│   │       │   ├── contribute/
│   │       │   │   └── page.tsx    # OSS Radar + Contribute tab
│   │       │   └── recall/
│   │       │       └── page.tsx
│   │       ├── components/
│   │       │   ├── layout/
│   │       │   │   ├── Sidebar.tsx
│   │       │   │   ├── Topbar.tsx
│   │       │   │   └── TabBar.tsx
│   │       │   ├── graph/
│   │       │   │   ├── MemoryGraph.tsx       # react-flow / d3.js wrapper
│   │       │   │   ├── NodeTooltip.tsx
│   │       │   │   └── GraphLegend.tsx
│   │       │   ├── contribute/
│   │       │   │   ├── ContributeHero.tsx
│   │       │   │   ├── SimilarBugCard.tsx
│   │       │   │   ├── ContribOpportunityCard.tsx
│   │       │   │   └── OSSSearchBar.tsx
│   │       │   └── shared/         # From ui-kit (see packages/)
│   │       │       ├── StatCard.tsx
│   │       │       ├── TagPill.tsx
│   │       │       └── MiniBarChart.tsx
│   │       └── lib/
│   │           ├── mcp-client.ts   # MCP HTTP client for Next.js
│   │           ├── api.ts          # Typed wrappers over MCP calls
│   │           └── store.ts        # Zustand global state
│   │
│   ├── vscode-extension/           # TypeScript IDE Extension (The Action Center)
│   │   ├── package.json            # Extension manifest, activationEvents, contributes
│   │   ├── tsconfig.json
│   │   ├── .vscodeignore
│   │   └── src/
│   │       ├── extension.ts        # activate() entry; registers all commands
│   │       ├── terminal/
│   │       │   ├── TerminalListener.ts     # onDidWriteTerminalData; exit code tracking
│   │       │   ├── ErrorPatternDetector.ts # Regex bank; secret stripper
│   │       │   └── FixDeltaComputer.ts     # Git diff between failure/success states
│   │       ├── sidebar/
│   │       │   ├── SidebarProvider.ts      # WebviewViewProvider
│   │       │   └── webview/
│   │       │       ├── index.tsx
│   │       │       ├── SessionPanel.tsx
│   │       │       ├── QuickRecall.tsx
│   │       │       ├── BugFeed.tsx
│   │       │       └── ContributeNudge.tsx
│   │       ├── commands/
│   │       │   ├── logTerminal.ts
│   │       │   ├── openRecall.ts
│   │       │   ├── markResolved.ts
│   │       │   └── openDashboard.ts
│   │       ├── git/
│   │       │   └── GitContextReader.ts     # branch, commit hash via child_process
│   │       └── mcp-client/
│   │           └── StdioMcpClient.ts       # stdio transport to Python MCP Server
│   │
│   └── cli/                        # CLI (The Power User Bridge)
│       ├── package.json
│       ├── bin/
│       │   └── devcontext           # CLI entry point (chmod +x)
│       └── src/
│           ├── index.ts             # Commander.js root
│           └── commands/
│               ├── recall.ts
│               ├── log.ts
│               ├── improve.ts
│               ├── forget.ts
│               ├── contribute.ts
│               └── graph.ts
│
├── packages/                        # Shared logic across apps
│   ├── types/                       # Shared TypeScript interfaces
│   │   ├── package.json
│   │   └── src/
│   │       ├── BugNode.ts
│   │       ├── MemoryNode.ts
│   │       ├── GitHubIssue.ts       # OSSRapport
│   │       └── GraphTypes.ts
│   └── ui-kit/                      # Shared Functional Cyberpunk React components
│       ├── package.json
│       └── src/
│           ├── NeonButton.tsx
│           ├── CyberpunkCard.tsx
│           ├── GlowTag.tsx
│           └── index.ts
│
└── services/
    └── mcp-server/                  # Python Backend (The Brain)
        ├── Dockerfile
        ├── requirements.txt
        ├── .env
        └── src/
            ├── server.py            # MCP Protocol definitions; tool schemas
            ├── cognee_ops.py        # remember(), recall(), improve(), forget() wrappers
            ├── github.py            # Lexical search + rate limit handler + OAuth
            ├── ingestion.py         # Smart ingestion orchestration; fix delta processing
            ├── graph_builder.py     # Transforms Cognee nodes → GraphNode[] + GraphEdge[]
            ├── error_parser.py      # Regex bank for error classification
            └── models/
                ├── bug.py
                ├── memory.py
                ├── github_issue.py
                └── graph.py
```

---

## 10. Data Models

### BugNode

```
BugNode {
  id:              UUID
  project_id:      string          # workspace folder name
  branch:          string
  commit_hash:     string | null
  error_type:      enum            # BUILD | RUNTIME | DEPENDENCY | NETWORK | UNKNOWN
  error_text:      string          # stderr block, max 2000 chars
  fix_delta:       string | null   # git diff between failure and success state
  source_file:     string | null
  dep_name:        string | null
  dep_version:     string | null
  status:          enum            # OPEN | RESOLVED | IGNORED
  fix_text:        string | null   # Human-readable fix summary, set on improve()
  created_at:      datetime
  resolved_at:     datetime | null
  github_issue_ids: UUID[]         # Linked GitHubIssueNodes (similarity > 0.80)
}
```

### MemoryNode (Cognee Internal)

```
MemoryNode {
  id:          UUID
  type:        enum    # BUG | DEPENDENCY | FIX | PROJECT | GITHUB_ISSUE
  content:     string  # Text fed to cognee.remember()
  metadata:    dict    # project, branch, error_type, timestamp — used for filtering
  created_at:  datetime
  updated_at:  datetime
  # embedding: float[] — managed internally by Cognee; not exposed directly
}
```

### GitHubIssueNode (OSSRapport)

```
GitHubIssueNode {
  id:             UUID     # Internal
  github_id:      int      # GitHub issue number
  repo_full:      string   # e.g. "google/android-ai-samples"
  title:          string
  body_excerpt:   string   # First 500 chars
  state:          enum     # OPEN | CLOSED
  labels:         string[] # e.g. ["good first issue", "bug"]
  similarity:     float    # 0.0–1.0 cosine vs local BugNode
  url:            string
  linked_bug_id:  UUID
  fetched_at:     datetime
}
```

### GraphResponse (Frontend)

```
GraphResponse {
  nodes: GraphNode[]
  edges: GraphEdge[]
}

GraphNode {
  id:     string
  type:   string   # "bug" | "dep" | "fix" | "project" | "github_issue"
  label:  string
  data:   dict     # Type-specific tooltip fields
}

GraphEdge {
  source: string
  target: string
  label:  string   # "caused_by" | "fixed_by" | "linked_to" | "belongs_to"
}
```

---

## 11. API Contract

### Base URL
- Development: `http://localhost:8000`
- Production: `https://shubham-pawar-devcontext.hf.space`

### MCP Tool Definitions (stdio / HTTP)

#### Tool: `remember_terminal_output`
```
Input {
  error_text:   string   # Required
  fix_delta:    string   # Required (git diff)
  project:      string   # Required
  branch:       string   # Required
  commit_hash:  string | null
  error_type:   string | null   # Auto-detected if null
  source_file:  string | null
  dep_name:     string | null
  dep_version:  string | null
}

Output {
  bug_id:           UUID
  memory_node_id:   UUID
  error_type:       string
  oss_scan:         "queued"
}
```

#### Tool: `recall_bug_graph`
```
Input {
  query:    string   # Required. Natural language
  project:  string   # Optional filter
  limit:    int      # Default 5, max 20
}

Output {
  results: [
    {
      bug_id:       UUID
      score:        float
      summary:      string
      error_text:   string
      fix_delta:    string | null
      fix_text:     string | null
      project:      string
      branch:       string
      created_at:   datetime
      github_issues: GitHubIssueNode[]
    }
  ]
  total: int
}
```

#### Tool: `scan_oss_opportunities`
```
Input {
  bug_id:   UUID    # Required
  refresh:  bool    # Force re-fetch. Default false
}

Output {
  similar_bugs: GitHubIssueNode[]   # similarity > 0.80
  opportunities: [
    {
      repo_full:    string
      stars:        int
      language:     string
      description:  string
      open_issues: [
        {
          issue_number: int
          title:        string
          labels:       string[]
          url:          string
        }
      ]
    }
  ]
}
```

### REST Endpoints (HTTP transport — Dashboard)

| Method | Path | Description |
|---|---|---|
| `POST` | `/ingest` | Wraps `remember_terminal_output` MCP tool |
| `GET` | `/recall` | Wraps `recall_bug_graph`; params: `q`, `project`, `limit` |
| `GET` | `/bugs` | Lists bugs; params: `project`, `status`, `error_type` |
| `POST` | `/improve/{bug_id}` | Calls `cognee.improve()`; body: `{ fix_text }` |
| `DELETE` | `/forget/{bug_id}` | Calls `cognee.forget()`; prunes orphaned nodes |
| `GET` | `/contribute/search` | Wraps `scan_oss_opportunities`; params: `bug_id`, `refresh` |
| `GET` | `/graph` | Returns `GraphResponse`; param: `project` |
| `GET` | `/auth/github` | Initiates GitHub OAuth flow |
| `GET` | `/auth/github/callback` | OAuth callback; returns JWT |
| `WS` | `/ws/notifications` | Push events: `bug_ingested`, `github_match_found`, `sync_complete` |

---

## 12. Reasoning on Key Implementation Decisions

### Why MCP Server Architecture (Not Direct SDK Calls)

Calling Cognee directly from each client (extension, dashboard, CLI) would couple the memory layer to every UI. If Cognee's API changes, all three surfaces break. Wrapping Cognee in an MCP Server means the brain has a **stable, typed tool interface** — clients call `recall_bug_graph`, not `cognee.recall()`. The MCP protocol also enables future clients (Neovim plugin, JetBrains extension, mobile app) to connect without modifying the backend. This is the architectural decision that makes the project production-ready rather than hackathon-only.

### Why Smart Exit-Code-Aware Ingestion (Not Keyword Matching)

Naive keyword matching (`ERROR`, `FAILED`) would poison the Cognee vector store with low-signal noise — build progress logs, deprecation warnings, and verbose debug output all contain these words. Exit-code tracking ensures we only ingest **meaningful failure events**. The fix delta (git diff between failure and success state) is the highest-signal data we can capture: it's exactly what changed to resolve the bug, with zero ambiguity. This delta, stored as the Fix Node, makes `recall()` results actionable — the developer gets not just "you had this bug" but "here is the exact code change that fixed it."

### Why Two-Step GitHub Retrieval (Lexical Then Semantic)

Passing the raw error text directly to an LLM and asking it to find matching GitHub issues is slow, expensive, and prone to hallucination. The LLM does not have access to current GitHub state and will confabulate issue numbers. The two-step approach is both more accurate and more efficient: GitHub's own full-text search (lexical) is optimised for finding exact error strings across 100 million repos in milliseconds. Cognee's cosine similarity (semantic) then ranks the top 10 candidates by how closely they match the *meaning* of the local bug, not just keyword overlap. The LLM is only invoked at the final step to draft a PR summary for confirmed high-confidence matches — its smallest, most valuable role.

### Why Next.js Over React + Vite for the Dashboard

Next.js App Router provides server-side rendering, which means the initial dashboard load shows meaningful content without waiting for JavaScript hydration — critical for a demo where judges are watching. The file-based routing also maps cleanly to the panel structure (Overview, Bugs, Graph, Contribute, Recall as separate routes). Vite + React would require manual router setup and produces a pure SPA with a blank screen on first load. The `lib/mcp-client.ts` can use Next.js Server Actions to proxy MCP calls server-side, avoiding CORS issues between the dashboard and the MCP Server.

### Why `react-flow` / `d3.js` for Graph Visualisation

The memory graph is a force-directed layout problem — nodes need to naturally cluster by relationship type and project. `react-flow` provides a production-ready React-idiomatic API with drag, zoom, and custom node rendering out of the box. `d3.js` gives lower-level control if custom physics are needed. Both are canvas or SVG-backed and scale to hundreds of nodes without DOM layout thrashing. A custom D3 force simulation from scratch would add 3–4 days of development time with no user-facing benefit.

### Why `@vscode/test-electron` for Extension Testing

The VS Code Extension's core logic (terminal listening, exit code tracking, fix delta computation) cannot be meaningfully tested without a real VS Code instance. `@vscode/test-electron` spins up a headless VS Code process, enabling simulation of actual terminal writes and verification that the ingestion regex fires correctly on real stack traces. Jest unit tests can cover the pure logic (regex patterns, payload construction) but only `test-electron` can verify the full activation event and WebView rendering pipeline.

### Why Shared `packages/types/` and `packages/ui-kit/`

All three clients (dashboard, extension WebView, CLI output formatting) need to agree on the shape of `BugNode`, `GitHubIssueNode`, and `GraphResponse`. Without shared types, the extension might render a field the dashboard renamed, causing silent data bugs. The shared `types/` package enforces a single source of truth. The `ui-kit/` package means the Functional Cyberpunk aesthetic (neon buttons, glow tags, cyberpunk cards) is defined once and reused across the dashboard and extension WebView — visual consistency with a single CSS change propagating everywhere.

### Why GitHub OAuth Over Personal Access Tokens

PATs require developers to understand GitHub token scopes, generate them manually, and paste them into config — high friction for a hackathon demo. OAuth provides a "Connect GitHub" button, scopes permissions correctly (`repo:read` for search, `public_repo` for PR draft), and stores the token server-side (never in the frontend or Cognee store). For the demo, a judge can connect their own GitHub account and see real issues matching a real bug — a far more compelling experience than a hardcoded token.

---

## 13. Implementation Plan — Phases

### Phase 1 — The Brain & Protocol (Days 1–2)

**Goal:** MCP Server running, Cognee wired, basic `remember` / `recall` working end-to-end.

Tasks:
- Scaffold monorepo with `pnpm` workspaces + `turbo`
- Initialize Python environment; install `cognee`, `mcp`, `fastapi`, `pytest`, `pytest-httpx`
- Establish local Cognee knowledge graph; verify persistence across server restarts
- Define MCP tool schemas in `server.py`: `remember_terminal_output`, `recall_bug_graph`, `scan_oss_opportunities`
- Implement `cognee_ops.py`: wrap all four Cognee lifecycle functions
- Implement `error_parser.py`: regex bank for Gradle, Python traceback, npm, Java, Kotlin errors
- Write `ingestion.py`: smart ingestion orchestration (exit-code flow, fix delta processing)
- Expose MCP Server via stdio transport

**Milestone:** Manually pipe a Gradle error text + fix delta into the Python script → retrieve it via a semantic query → correct bug returned.

**Test checkpoint:** `pytest tests/test_cognee_ops.py` — `remember()` stores, `recall()` returns, `forget()` removes, `improve()` updates.

---

### Phase 2 — The IDE Observer (Days 3–4)

**Goal:** VS Code Extension detects errors, computes fix delta, sends to MCP Server; sidebar renders.

Tasks:
- Scaffold VS Code extension with TypeScript
- Implement `TerminalListener.ts`: `onDidWriteTerminalData` handler with exit-code tracking
- Implement `ErrorPatternDetector.ts`: regex bank + secret stripper
- Implement `FixDeltaComputer.ts`: `child_process.exec('git diff')` between failure and success states
- Implement `GitContextReader.ts`: branch + commit hash
- Build `StdioMcpClient.ts`: stdio transport to Python MCP Server
- Build `SidebarProvider.ts` WebView with Functional Cyberpunk HTML/CSS injection
- Build `QuickRecall.tsx`, `BugFeed.tsx`, `ContributeNudge.tsx` WebView components
- Register all four commands

**Milestone:** Throw an error in VS Code terminal → error appears in sidebar bug feed → fix the error → fix delta computed and sent to MCP Server.

**Test checkpoint:** `@vscode/test-electron` — simulate 5 different terminal error outputs; verify correct classification and payload structure for each.

---

### Phase 3 — The OSS Radar (Days 4–5)

**Goal:** Two-step GitHub retrieval working; Contribute tab shows real OSS matches.

Tasks:
- GitHub OAuth 2.0 flow in `server.py` (`/auth/github`, `/auth/github/callback`)
- `github.py`: Step 1 lexical search (`is:issue is:open` + error keywords); rate limit handler with `pytest-httpx` mock
- `github.py`: Step 2 — ingest top 10 issues into Cognee as `GitHubIssueNode`; compute cosine similarity; filter at 0.80
- LLM PR/issue summary drafting for high-confidence matches
- `scan_oss_opportunities` MCP tool wired to `github.py` orchestration
- WebSocket `/ws/notifications` push when matches found
- Build Next.js `contribute/page.tsx` with `ContributeHero`, `SimilarBugCard`, `ContribOpportunityCard`
- Wire `ContributeNudge.tsx` in VS Code sidebar to WebSocket events

**Milestone:** Fix a real `aicore-sdk` Gradle error locally → within 5 seconds, Contribute tab surfaces a matching open issue from `google/android-ai-samples` with > 80% confidence.

**Test checkpoint:** Mock GitHub API with `pytest-httpx`; verify graceful degradation when rate limit is hit (429 response); verify similarity filter correctly excludes sub-0.80 matches.

---

### Phase 4 — The Command Deck & Polish (Days 6–7)

**Goal:** Full Next.js dashboard, CLI, graph visualisation, and demo-ready.

Tasks:
- Build remaining Next.js pages: `overview/`, `bugs/`, `graph/`, `recall/`
- Implement `MemoryGraph.tsx` with `react-flow` or `d3.js`; node type colouring; hover tooltips
- Build `graph_builder.py` in MCP Server: transforms Cognee internal nodes → `GraphResponse`
- Scaffold and implement CLI (`apps/cli/`): all 6 commands wired to MCP Server
- Build `packages/ui-kit/`: `NeonButton`, `CyberpunkCard`, `GlowTag` shared components
- Docker Compose: MCP Server + Cognee store cold-start in one command
- Deploy MCP Server to HuggingFace Spaces (port 7860)
- Deploy Dashboard to Vercel; set env vars to HF Spaces URL
- Write demo script: terminal error → sidebar capture → recall → memory graph → contribute tab → post fix comment
- Record 2-minute demo video
- Write submission README with architecture diagram

**Milestone:** Live URLs for dashboard and MCP Server; end-to-end demo flow runs without errors; CLI `devcontext recall "kotlin duplicate class"` returns correct result in stdout.

**Test checkpoint:** Full manual QA checklist (see Section 14). `playwright` E2E on deployed Vercel URL.

---

## 14. Testing Strategy

### Unit Tests — MCP Server (`pytest`)

| Test File | What It Tests |
|---|---|
| `test_cognee_ops.py` | `remember()` stores; `recall()` returns ranked results; `improve()` updates; `forget()` removes and prunes orphaned nodes |
| `test_ingestion.py` | Exit-code-aware capture logic; fix delta extraction; secret stripping |
| `test_error_parser.py` | Regex patterns correctly classify Gradle, Python traceback, npm, Java, Kotlin errors from 10 sample inputs |
| `test_github.py` | Lexical search returns correct shape; similarity filter excludes < 0.80; rate limit mock returns graceful degradation |
| `test_graph_builder.py` | Cognee nodes correctly transformed to `GraphNode[]` + `GraphEdge[]`; orphaned nodes excluded |

**Golden Dataset — Vector Recall:**
- Create a dataset of **20 known terminal errors** and their correct fix memories
- Assert `cognee.recall()` returns the correct fix within the **top 2 results for ≥ 95%** of queries
- Run: `pytest tests/test_recall_golden.py -v`

**Rate Limit QA (`pytest-httpx`):**
- Mock GitHub API to return `429 Too Many Requests`
- Assert the system logs the error, skips OSS scan, and sends `{ "type": "github_search_failed" }` via WebSocket
- Assert no exception propagates to the `/ingest` response

**Graph Integrity:**
- Ingest 3 bugs sharing a dependency node
- `forget()` one bug
- Assert the dependency node still exists (still connected to 2 remaining bugs)
- `forget()` all remaining bugs
- Assert the dependency node is **pruned** (orphaned node removed)

```bash
cd services/mcp-server
pytest tests/ -v --cov=src --cov-report=term-missing
```

**Coverage target:** ≥ 70% for all routes and services.

---

### Unit Tests — Frontend (`vitest`)

| Test File | What It Tests |
|---|---|
| `SimilarBugCard.test.tsx` | Renders match %, repo name, action buttons; hides "Post Fix" if not authenticated |
| `ContributePanel.test.tsx` | Hero stats render; empty state shown when no matches |
| `MemoryGraph.test.tsx` | Correct number of nodes rendered for mock GraphResponse |
| `RecallPanel.test.tsx` | Input calls MCP client; results render; empty state handled |

```bash
cd apps/web-dashboard
pnpm test
```

---

### VS Code Extension Tests (`@vscode/test-electron`)

| Test | What It Tests |
|---|---|
| Terminal ingestion E2E | Simulate Node.js/Python/Gradle stack traces in headless VS Code; verify `ErrorPatternDetector` fires; verify payload sent to MCP Server without blocking UI |
| Fix delta computation | Simulate file change between failure and success; verify `FixDeltaComputer` produces correct git diff string |
| Sidebar rendering | Verify WebView mounts without error on extension activation |

**Why `@vscode/test-electron`:** Pure unit tests cannot verify the `onDidWriteTerminalData` API binding or the WebView activation lifecycle. Headless VS Code is the only environment where these can be tested deterministically.

```bash
cd apps/vscode-extension
pnpm test:e2e
```

---

### E2E Tests — Dashboard (`playwright`)

| Scenario | Steps |
|---|---|
| Recall flow | Load dashboard → enter query in Recall page → verify results appear within 3s |
| Contribute flow | Navigate to Contribute → verify hero stats + bug cards render with mock data |
| Mark resolved | Click "Mark Resolved" on bug → verify status badge updates to resolved |
| Graph renders | Navigate to Memory Graph → verify ≥ 1 node visible in canvas |
| OSS match notification | Trigger ingest → wait for WebSocket event → verify ContributeNudge banner appears |

```bash
cd apps/web-dashboard
pnpm e2e
```

---

### Manual QA Checklist (Pre-submission)

- [ ] `docker-compose up` from cold start — no errors, MCP Server reachable at `localhost:8000`
- [ ] Ingest a real Gradle error via VS Code extension terminal listener
- [ ] Bug appears in sidebar Bug Feed within 3 seconds
- [ ] Recall query returns the ingested bug with fix delta in the result
- [ ] Memory graph shows Bug → Dependency → Fix node chain
- [ ] Contribute tab returns ≥ 1 real GitHub issue match (similarity shown)
- [ ] "Post Your Fix" redirects to correct GitHub issue URL
- [ ] Mark Resolved updates bug status badge in UI
- [ ] `forget()` removes bug; verify it does not appear in next recall
- [ ] CLI: `devcontext recall "gradle conflict"` returns correct result in stdout
- [ ] CLI: `devcontext contribute` lists current OSS matches
- [ ] Dashboard deployed on Vercel — loads without errors on mobile viewport
- [ ] Extension installs and activates in VS Code Stable and Insiders

---

## 15. Non-Functional Requirements

### Performance

| Metric | Target |
|---|---|
| MCP `remember_terminal_output` response | < 800ms (excluding async GitHub scan) |
| MCP `recall_bug_graph` response | < 1200ms (Cognee hybrid search) |
| Dashboard initial page load (SSR) | < 2s localhost; < 4s Vercel |
| GitHub two-step retrieval completion | < 6s (async; WebSocket notification on completion) |
| Memory graph render (50 nodes) | < 500ms |
| CLI `devcontext recall` response | < 1500ms (includes stdio round-trip) |

### Reliability

- MCP Server must handle Cognee SDK errors gracefully — if `remember()` fails, the endpoint still returns `202` and logs the error; it never crashes
- GitHub API failures are retried once with 2s backoff; on second failure, scan is skipped and `github_search_failed` WebSocket event is pushed
- WebSocket reconnects automatically with exponential backoff (max 30s)
- `forget()` must run `orphan_prune()` after node removal to prevent memory bloat

### Accessibility

- Dashboard: keyboard navigable; ARIA labels on icon-only buttons; WCAG AA colour contrast
- VS Code Extension: respects VS Code theme variables; `prefers-reduced-motion` honoured

---

## 16. Security & Privacy

### What Is Stored in Cognee

- Terminal error text (stderr blocks, max 2000 chars)
- Fix delta (git diff between failure and success state)
- Git metadata (branch, commit hash, project name)
- GitHub issue content (fetched from public API; stored as graph nodes)

### What Is Never Stored

- `.env` file contents — `ErrorPatternDetector` strips lines matching `KEY=VALUE` before ingestion
- Authentication tokens — GitHub OAuth token is session-only, server-side, never written to Cognee
- Full file contents — only file *names* parsed from stacktraces; not file content

### Local-First by Default

- Cognee store persists to `~/.cognee/` on the developer's machine
- No data leaves the machine unless the developer explicitly deploys the MCP Server to HuggingFace Spaces
- HuggingFace Spaces deployment is opt-in; all features work in local-only mode

### Data Retention

- `forget()` is the user's data deletion mechanism — removes from both vector and graph store, prunes orphans
- Project deletion triggers `forget()` for all nodes tagged with that `project_id`

---

## 17. Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Cognee API changes before July 5 | Low | High | Pin Cognee to exact version in `requirements.txt`; read changelog before each session |
| MCP SDK breaking change | Low | High | Pin `mcp` package version; test stdio transport on Day 1 before building on top of it |
| GitHub API rate limit during demo | Medium | High | Use authenticated token (5000 req/hr); cache results in Cognee as `GitHubIssueNode`; pre-fetch results before demo session |
| Fix delta computation fails on binary files | Low | Medium | `FixDeltaComputer` filters binary file diffs; only text file deltas ingested |
| VS Code `onDidWriteTerminalData` API unavailable | Low | Medium | Specify `engines.vscode: "^1.85.0"` in `package.json`; API stable since 1.46 |
| Cognee recall quality too low | Medium | High | Prefix ingestion content with error type and project name to improve embedding specificity; tune golden dataset threshold |
| Docker Compose networking differences on Windows | Medium | Low | Test on Windows early; add `host.docker.internal` references for extension → MCP Server communication |
| HuggingFace Spaces cold start delay | Medium | Medium | Keep Space warm during hackathon window; pre-ping before demo |
| Next.js / Vercel deployment CORS with HF Spaces | Medium | Medium | Configure CORS middleware in `server.py`; use Next.js API routes as proxy if needed |

---

## 18. Open Questions

1. **MCP transport for CLI** — stdio (spawns MCP Server as child process) or HTTP (assumes MCP Server already running)? stdio is simpler for local dev but requires the server process to start on each CLI invocation. HTTP assumes a persistent server. Decision needed before Phase 1 scaffold.

2. **Cognee graph export format** — Does Cognee expose internal graph as `(node, edge)` pairs natively, or does `graph_builder.py` maintain its own edge registry? Requires Cognee SDK source review before Phase 4.

3. **Embedding model for GitHub similarity** — Cognee's default embedder vs. a custom `sentence-transformers/all-MiniLM-L6-v2` for the issue matching step. Custom model gives control over similarity thresholds; default is zero-config. Decision affects Phase 3.

4. **`react-flow` vs `d3.js`** — `react-flow` is faster to implement; `d3.js` gives full physics control. If the graph has < 100 nodes (likely for hackathon demo), `react-flow` is sufficient. Decision needed at Phase 4 start.

5. **Multi-project isolation in Cognee** — For the hackathon demo, one project (pocketmind) suffices. For the major project, `project_id` metadata filtering must be verified to provide true isolation between projects in a shared Cognee store. Needs verification before major project submission.

6. **PR Draft UX** — "Draft PR" currently redirects to GitHub's PR creation URL with pre-filled body. A richer path would be a modal with an editable PR body before redirect. Scoped out of hackathon; revisit for major project.

---

## 19. Glossary

| Term | Definition |
|---|---|
| Cognee | Open-source memory infrastructure library providing hybrid graph-vector storage with `remember()`, `recall()`, `improve()`, `forget()` APIs |
| MCP | Model Context Protocol — a standard protocol for exposing AI tools to clients; enables any client to call `remember_terminal_output` without knowing Cognee's internals |
| MCP Server | The Python FastAPI process that hosts MCP tool definitions and wraps Cognee; "The Brain" of the system |
| Hybrid Store | A storage system combining a vector database (semantic similarity) and a graph database (structural relationships) |
| Fix Delta | The git diff of workspace files between a command's non-zero exit (failure) and subsequent zero exit (success); the most precise representation of what resolved a bug |
| OSS Radar | The Contribute feature — two-step retrieval (lexical → semantic) that surfaces public GitHub issues matching the developer's local bugs |
| Two-Step Retrieval | Lexical search (GitHub API) to narrow candidates, followed by semantic matching (Cognee cosine similarity) to rank them — prevents LLM hallucination |
| Functional Cyberpunk | The product's visual aesthetic — high-tech, low-friction, dark background with neon accent colours; used across all three client surfaces |
| Golden Dataset | A curated set of 20 known terminal error + fix pairs used to benchmark `recall()` accuracy (target: correct fix in top 2 results for ≥ 95% of queries) |
| Orphaned Node | A graph node (e.g. a Dependency node) that has no remaining edges after its connected Bug nodes are deleted via `forget()`; must be pruned to prevent memory bloat |
| Good First Issue | A GitHub label indicating an issue suitable for first-time contributors; a primary filter in the Contribution Opportunity Radar |
| WebView | A VS Code UI surface that renders HTML/CSS/JS inside an IDE panel |
| stdio transport | A communication method where the MCP Server is spawned as a child process and clients communicate via standard input/output streams |
| BackgroundTask | FastAPI's mechanism for running async work (GitHub scan) after an HTTP response has already been sent |
| OSSRapport | Internal TypeScript type alias for `GitHubIssueNode` — a GitHub issue matched to a local bug with a computed similarity score |

---

*End of Document — DevContext Assistant PRD v2.0.0*
