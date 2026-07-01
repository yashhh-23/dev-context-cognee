# Live Contributors Document

> This document is automatically generated to track contributions to the project based on the Git commit history.

## yashhh-23 (66 commits)

| Commit | Date | Message |
|---|---|---|
| `16e1e32` | 2026-06-30 | chore: strictly add empty skeleton files per fiks.md |
| `58799dd` | 2026-06-30 | Revert "chore: add empty skeleton files for memory management features" |
| `eb21407` | 2026-06-30 | chore: add empty skeleton files for memory management features |
| `2051c2b` | 2026-06-30 | docs: create doccs folder with context.md and PRD.md |
| `c32f545` | 2026-06-30 | Remove fastembed to fix Vercel bundle size limit |
| `1acd226` | 2026-06-30 | Add backend dependencies to pyproject.toml for Vercel deployment |
| `929037f` | 2026-06-30 | Fix Vercel entrypoint in pyproject.toml |
| `cba77cb` | 2026-06-29 | Refactor CLI to use background daemon, config system, and shell hooks |
| `7b185df` | 2026-06-29 | Fix high severity bugs in backend API and security configuration |
| `2b579ad` | 2026-06-29 | perf: optimize O(n^2) embedding conflict detection in recall |
| `afa1aa9` | 2026-06-29 | fix: implement Phase 1-6 bug fixes, BYOK encryption, and frontend Polish |
| `2445f86` | 2026-06-29 | fix: apply bug fixes from notn.md |
| `a8af996` | 2026-06-29 | Fix bugs, refactor APIs, and update frontend components per implementation plan |
| `5538caf` | 2026-06-29 | Apply bug fixes from audit |
| `6c9922d` | 2026-06-29 | Fix backend endpoints and VS Code Extension integration |
| `80e46c4` | 2026-06-28 | fix: replace hard crash env checks with fallback settings in NextAuth route |
| `4fa7000` | 2026-06-27 | fix: wrap signin Client Component in Server Component to bypass Vercel Next.js 16 builder bug |
| `a5aecc3` | 2026-06-27 | fix: removed cognee_utils.py, updated mcp_server.py to use Cognee native dedup, fixed 307 trailing slash redirects in FastAPI routers, added fallback NEXTAUTH_SECRET to fix Vercel deployment error |
| `4760382` | 2026-06-27 | fix: update api.ts paths to match backend routes |
| `5e1741f` | 2026-06-27 | fix(backend,frontend): clean up imports, optimize loops, resolve N+1 queries, and compute real metrics |
| `96d3209` | 2026-06-27 | feat(cli): upgrade cli to use typer and add watch mode |
| `594d0b3` | 2026-06-27 | fix(frontend): resolve TypeScript type mismatch in MemoryHealthModal |
| `a116824` | 2026-06-27 | feat(security): implement NextAuth, BYOK GCM-256 database encryption, prompt injection hardening |
| `4affb65` | 2026-06-27 | fix: resolve backend and frontend api issues |
| `4e02fba` | 2026-06-26 | Revert "feat: add /api/memories/auto-clean endpoint + frontend auto-clean on recall page load" |
| `225e2c6` | 2026-06-26 | vercel deploy |
| `6ed7966` | 2026-06-26 | cleanup: remove diagnostic db-check endpoint |
| `5cc2f0e` | 2026-06-26 | diagnostics: add /db-check endpoint |
| `bc60172` | 2026-06-26 | fix: add vercel frontend URL to CORS allowed origins |
| `0891d7f` | 2026-06-26 | fix: make DB init fault-tolerant so app starts even if DATABASE_URL is unreachable |
| `89d7eff` | 2026-06-26 | fix: explicit pin fastapi-users 13.0.0 to prevent pip backtracking on render |
| `b84fa8e` | 2026-06-26 | fix: relax tenacity version to resolve instructor dependency conflict |
| `f666b1e` | 2026-06-26 | fix: downgrade uvicorn to 0.22.0 to resolve cognee dependency conflict on render |
| `05687f8` | 2026-06-26 | fix: upgrade sqlalchemy to 2.0.35 to resolve cognee dependency conflict on render |
| `0ab16bd` | 2026-06-26 | fix: upgrade pydantic to 2.8.2 and fix local scope error in recall.py |
| `9953b26` | 2026-06-26 | fix: downgrade fastapi to resolve cognee dependency conflict on render |
| `4fecde3` | 2026-06-26 | fix: bump alembic version to resolve cognee dependency conflict on render |
| `99fbc37` | 2026-06-26 | chore: implement pre-deployment code changes |
| `71f780d` | 2026-06-26 | fix: graph label visibility in light mode |
| `4d7548f` | 2026-06-26 | feat: Group 3 utilities for API calls and token management |
| `5742e05` | 2026-06-25 | fix: use workspace-relative paths in vscode settings |
| `4254f94` | 2026-06-25 | extra file |
| `72d1a0b` | 2026-06-25 | feat: Add Cognee deduction layer and Multi-IDE MCP integration |
| `a31320a` | 2026-06-24 | feat: implement dashboard overview panels, backend API endpoints for project context, system statistics, and GitHub issue trend tracking. |
| `df59981` | 2026-06-24 | open bugs issue fixed |
| `29ed600` | 2026-06-24 | router added for bug search |
| `9c53187` | 2026-06-24 | bugs github api fixed |
| `0426cf5` | 2026-06-24 | switched to gemini 2.5 flash for better efficiency |
| `48cf7ba` | 2026-06-23 | fix backend config loading path and frontend next.config.ts |
| `e64bb31` | 2026-06-23 | refactor(llm): swap openai for groq as gemini fallback |
| `44c85ce` | 2026-06-23 | feat(llm): configure Cognee to support Gemini API automatically |
| `a24cea5` | 2026-06-23 | Merge remote-tracking branch 'origin/feature/dashboard-v2' |
| `f9edd57` | 2026-06-23 |   implement dashboard statistics API and typed frontend client service |
| `3262c1f` | 2026-06-23 | Merge branch 'feature/dashboard-v2' |
| `a768449` | 2026-06-23 | add CLI ingestion tool and backend endpoints for bug analysis and GitHub contribution discovery |
| `4c31e82` | 2026-06-23 | build graph api added |
| `07ec298` | 2026-06-23 | github authentication added |
| `4d986cf` | 2026-06-23 | fixed endpoints |
| `121134b` | 2026-06-23 |  implement initial API client and WebSocket hook for backend communication |
| `b960bde` | 2026-06-22 | Implement Phase 3 and clean up repo |
| `c3b886d` | 2026-06-21 | phase 3 bugs |
| `c664e2f` | 2026-06-21 | phase 3 implemented |
| `455dabf` | 2026-06-21 | phase 2 bugs |
| `752b3d4` | 2026-06-21 | phase 2 implmented |
| `d5f25de` | 2026-06-21 | bug fixed |
| `e21d8c6` | 2026-06-21 | backend phase 1 |

## Yash Dedhia (46 commits)

| Commit | Date | Message |
|---|---|---|
| `37d152f` | 2026-06-30 | feat: Stage 2 — memory lifecycle commands, visual graph, gamification, backend memify/forget routes |
| `f59a663` | 2026-06-27 | fix(api): fix mock fallback ordering - specific /api/recall/* routes before broad prefix |
| `c799359` | 2026-06-27 | fix(main): remove unused import subprocess |
| `6288979` | 2026-06-27 | fix(mocks): add code_quality, test_coverage, documentation fields to stats.json mock |
| `28ec7dc` | 2026-06-27 | fix(recall): replace N+1 DB queries with single bulk PinnedNode fetch using .in_() |
| `e523516` | 2026-06-27 | fix(security): remove hardcoded NEXTAUTH_SECRET and DASHBOARD_PASSWORD fallbacks |
| `f285481` | 2026-06-27 | fix: remove hardcoded fake data from main.py and stats.py |
| `cfb35f8` | 2026-06-27 | fix(extension): correct recall route /api/memory/recall → /api/recall to match backend router |
| `cb2468b` | 2026-06-27 | fix(sessions): decrypt terminal_output with BYOK key before returning to client |
| `74f3829` | 2026-06-27 | feat(auto-clean): LLM-powered supersede detection via Gemini 1.5 Flash → Groq fallback |
| `c4241ff` | 2026-06-27 | feat(dashboard): add Memory Health modal with Cognee stats, topic distribution, decay & auto-clean toggle |
| `aeea670` | 2026-06-26 | feat: add /api/memories/auto-clean endpoint + frontend auto-clean on recall page load |
| `4a4b3a3` | 2026-06-26 | fix: add filelock+websockets to requirements, fix variable shadowing in recall.py |
| `c9367ad` | 2026-06-26 | docs: full README rewrite — accurate architecture, correct env vars, manual setup steps, extension install guide |
| `445cb97` | 2026-06-26 | fix(extension): clean package.json — fix activationEvents, add maxRecallResults, remove stale cogneeApiKey ref, add secretStorage note |
| `4f92c5c` | 2026-06-26 | feat(backend): add missing __init__ files, bug_service, and updated requirements |
| `e447e1b` | 2026-06-26 | Group 5: full sidebar WebView UI + provider.ts, update extension.ts to use it |
| `e98ba0c` | 2026-06-26 | Group 4: extract commands into src/commands/, refactor extension.ts to use ApiClient + bridges |
| `2f1777b` | 2026-06-26 | feat(extension): Group 2 - rewrite extension.ts with full activation logic |
| `dacb8d4` | 2026-06-26 | feat(extension): Group 1 - upgrade package.json + add .vscodeignore |
| `6505e8e` | 2026-06-24 | refactor(contribute): move import asyncio to top-level imports (PEP 8) |
| `0dd8efa` | 2026-06-24 | refactor(bugs): inline _get_repo() helper — use settings.GITHUB_REPO directly |
| `0bddde8` | 2026-06-24 | fix(bugs+recall): add /bugs/{id}/recall route, fix Cognee SearchResult str() dump |
| `01720ad` | 2026-06-24 | fix(bugs): remove broken @property module-level aliases, clean up GITHUB_TOKEN/REPO exports |
| `0aa182a` | 2026-06-24 | fix(contribute+bugs): fetch good-first-issues from cognee + OSS repos, fix env var loading |
| `6def2fa` | 2026-06-23 | fix(topbar+graph+config): offline indicator, branch fallback, fix-node label, next.config rewrites |
| `bd31174` | 2026-06-23 | fix(graph): align frontend node types + colors with backend graph_builder output |
| `66a4071` | 2026-06-23 | fix(all): 7 bugs — recall routes, getSessions mapping, memify/forget/suggest endpoints, cognee config, GITHUB_REPO settings, timestamp null crash |
| `abfba3a` | 2026-06-23 | fix(stats+sessions): real memory_nodes from graph, dynamic recalled_today, fix session shape mismatch, batch bug-trend API calls |
| `fa561be` | 2026-06-23 | fix(bugs,contribute): remove duplicate GITHUB_REPO, move _map_severity to top, align contribute schema to frontend |
| `7b754f6` | 2026-06-23 | fix(conflicts): resolve merge conflicts with main — accept feature branch versions |
| `c2c941f` | 2026-06-23 | fix(api): commit 6 — real GitHub bugs/contribute routes, live bug trend, fix hardcoded data |
| `ad3b0bd` | 2026-06-23 | Merge pull request #6 from yashhh-23/feature/dashboard-v2 |
| `ac5fb34` | 2026-06-23 | feat(polish): commit 4 — WS live events, chart, package deps, README |
| `e3c1377` | 2026-06-23 | Merge pull request #5 from yashhh-23/feature/dashboard-v2 |
| `aba5526` | 2026-06-23 | feat(frontend): dashboard pages — overview, bugs, contribute, graph, recall |
| `2c7c5be` | 2026-06-23 | Merge pull request #3 from yashhh-23/feature/dashboard-v2 |
| `4230699` | 2026-06-23 | Merge pull request #4 from yashhh-23/main |
| `98ef2ce` | 2026-06-23 | feat(frontend): dashboard shell — layout, design tokens, sidebar, topbar, routing |
| `f071d57` | 2026-06-23 | Merge pull request #2 from yashhh-23/feature/dashboard-v2 |
| `85edc80` | 2026-06-23 | feat(frontend): complete dashboard-v2 — Overview, Bugs, Recall, MemoryGraph, Contribute panels + layout + API client + WebSocket + globals |
| `66aa1ec` | 2026-06-23 | feat(backend): add recall, graph, stats, improve, forget, contribute routes + WebSocket + graph builder |
| `c90a6ce` | 2026-06-22 | Merge pull request #1 from yashhh-23/ui-redesign |
| `2e824fd` | 2026-06-22 | refactor(ui): complete dashboard redesign — Linear/Vercel-style system |
| `8a38ffe` | 2026-06-22 | phase 4: full dashboard redesign + bugs/stats backend endpoints |
| `095edbc` | 2026-06-21 | fix: use cognee v1.0 remember/recall API, fix ingest_service indentation, clean up router and search endpoint |

## Sahil Rane (27 commits)

| Commit | Date | Message |
|---|---|---|
| `248cf90` | 2026-06-30 | feat: implement bug analysis and ingestion APIs with GitHub integration and memory recall |
| `8320814` | 2026-06-30 | feat: implement CLI for session management, ingestion, and memory recall with feedback loop |
| `813c2dc` | 2026-06-29 | fix(frontend): implement robust UI stability and production safety guardrails |
| `223355b` | 2026-06-29 | fix: resolve trailing conflict marker in recall.py |
| `bf92de7` | 2026-06-29 | feat: consolidate embeddings cache, resolve conflict, add feedback UI and memory decay |
| `8324109` | 2026-06-28 | feat: initialize dev-context CLI package with dependency configuration and entry point |
| `3229990` | 2026-06-28 | Fix clean install dependency gaps and update CLI setup documentation |
| `4fd8af2` | 2026-06-28 | Fix cross-platform compatibility warnings, optimize frontend API imports, and update semantic deduplication |
| `fc4230f` | 2026-06-28 | feat: implement dashboard overview with repository health metrics, session tracking, and API integration |
| `1ad0fd9` | 2026-06-27 | feat: add dashboard stats and GitHub bug trend endpoints |
| `40cbf49` | 2026-06-27 | feat: implement dashboard overview client with dependency health tracking and memory auto-clean functionality |
| `0ba40cc` | 2026-06-27 | feat: implement session management and memory lifecycle APIs with LLM-powered deduplication |
| `50be600` | 2026-06-27 | fix(frontend): resolve ESLint and React hook lifecycle warnings |
| `c6fc6bb` | 2026-06-27 | fix(frontend): resolve ChatBubbleIcon style prop type error in RecallClient |
| `69a80c4` | 2026-06-27 | feat(frontend): replace emojis with professional, custom animated SVG icons |
| `f7f9e4e` | 2026-06-27 | feat: implement session management, memory lifecycle controls, and node pinning API |
| `8bfe0d2` | 2026-06-27 | feat(frontend): add smooth wave theme transition using startViewTransition |
| `5898e3f` | 2026-06-27 | style(frontend): make Ingest console stream terminal theme-aware |
| `fb40959` | 2026-06-27 | style(frontend): fix bug trend chart width to occupy full space |
| `ca1d0ac` | 2026-06-27 | feat(frontend): implement eye-protective warm cream light mode and smooth theme transitions |
| `a30e8e1` | 2026-06-27 | fix(frontend): change health check path to /health to match backend |
| `ebacc51` | 2026-06-27 | feat(frontend): implement premium dashboard, recall & ask, memory graph manager, and ingest pages with fallbacks and tests |
| `fb37d3a` | 2026-06-26 | build: restore requirements.txt to original pinned dependencies |
| `ff54d52` | 2026-06-26 | test: add integration test scripts for MCP memory flow and search score diagnostics |
| `6d3d1a6` | 2026-06-26 | feat: implement MCP server with Cognee memory management, deduplication, and source code indexing. |
| `f07cab2` | 2026-06-25 | feat: implement MCP server with file system watcher and automate source code indexing in Cognee |
| `2b52bcf` | 2026-06-24 | fix: clean up unused props, hook deps, eslint/ts config exclusions, .venv gitignore |

## frag2win (9 commits)

| Commit | Date | Message |
|---|---|---|
| `cb10e89` | 2026-06-30 | feat: enhance ingest command to support file ingestion and improve error handling |
| `91c98b6` | 2026-06-30 | Merge branch 'main' of https://github.com/yashhh-23/dev-context-cognee |
| `e4356df` | 2026-06-30 | feat: add graph_output.json to track graph data structures |
| `6b40f3a` | 2026-06-30 | feat: add health check command and JSON output options for API interactions |
| `17284a3` | 2026-06-30 | docs: update LIVE_CONTRIBUTORS.md to include new contributor and contributions |
| `d664045` | 2026-06-30 | docs: generate LIVE_CONTRIBUTORS.md to track project contributions |
| `eb11ee9` | 2026-06-30 | docs: add automatically generated live contributors tracking document |
| `db41e79` | 2026-06-30 | feat: add script to generate live contributors document from git commit history |
| `fdc34c0` | 2026-06-30 | Refactor code structure for improved readability and maintainability |

## github-actions[bot] (6 commits)

| Commit | Date | Message |
|---|---|---|
| `442a22f` | 2026-06-30 | docs: auto-update LIVE_CONTRIBUTORS.md [skip ci] |
| `07571b9` | 2026-06-30 | docs: auto-update LIVE_CONTRIBUTORS.md [skip ci] |
| `4c42251` | 2026-06-30 | docs: auto-update LIVE_CONTRIBUTORS.md [skip ci] |
| `b92015a` | 2026-06-30 | docs: auto-update LIVE_CONTRIBUTORS.md [skip ci] |
| `9119e9a` | 2026-06-30 | docs: auto-update LIVE_CONTRIBUTORS.md [skip ci] |
| `2c3ef53` | 2026-06-30 | docs: auto-update LIVE_CONTRIBUTORS.md [skip ci] |

