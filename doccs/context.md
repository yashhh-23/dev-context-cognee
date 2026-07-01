# Developer Context & Architecture Overview

This document provides a high-level overview of the `dev-context-cognee` codebase, its architecture, and execution flow to help new developers quickly onboard.

## 1. System Architecture

`dev-context-cognee` is an AI memory engine for developer workflows, built on top of the **Cognee** knowledge graph framework. It consists of three main components:

1. **Input Layer (VS Code Extension & CLI)**: Captures code context, active files, and bug logs, sending them to the backend.
2. **Backend (FastAPI)**: Serves as the orchestration layer, managing Cognee memory (ingest, recall, forget) and interacting with LLM providers to draft GitHub issues.
3. **Frontend (Next.js)**: A dashboard to visualize the knowledge graph and manage stored memory.

```
┌──────────────────────────────────────────────────┐
│  VS Code Extension / CLI                         │
└─────────────────────┬────────────────────────────┘
                      │ HTTP / WebSocket
┌─────────────────────┴────────────────────────────┐
│  FastAPI Backend (backend/)                      │
│   - POST /api/ingest (stores context)            │
│   - POST /api/recall (similarity search)         │
│   - POST /api/bugs/draft-issue (LLM execution)   │
└─────────────────────┬────────────────────────────┘
                      │
┌─────────────────────┴────────────────────────────┐
│  Cognee Core (Knowledge Graph & Vector Store)    │
└──────────────────────────────────────────────────┘
```

## 2. Directory Structure & Key Files

- `backend/`: Python FastAPI application.
  - `backend/app/main.py`: Entry point for all API routes.
  - `backend/app/api/`: Contains route handlers for ingestion, recall, graph visualization, and GitHub contribution.
  - `backend/app/services/`: Core logic wrapping Cognee functions.
- `frontend/`: Next.js dashboard providing UI for the memory graph.
- `extension/`: TypeScript VS Code extension source code.
  - `extension/src/commands/`: Implementation of `rememberContext`, `recallBugs`, and `draftIssue` keybindings.
- `mcp/`: Model Context Protocol server exposing Cognee memory tools to Claude Desktop/Cursor.
- `cli/`: Python CLI for standard input ingestion.

## 3. The Memory Lifecycle

The core execution flow revolves around Cognee's memory lifecycle:
1. **Capture**: A developer triggers a save command via VS Code (`Cmd+Shift+M`). The extension sends raw context (file contents + symbols) to `/api/ingest`. The backend calls `cognee.add()` and `cognee.cognify()` in the background to build a knowledge graph.
2. **Recall**: When debugging, a developer triggers recall (`Cmd+Shift+R`). The backend hits `/api/recall`, invoking `cognee.search()` to fetch related past sessions via vector similarity.
3. **Action**: The developer triggers an issue draft (`Cmd+Shift+I`). The backend executes `cognee.llm_query()` combining the error snippet and recalled memory into a structured GitHub issue body.

## 4. Running the Project Locally

The simplest way to spin up the entire stack is via Docker:
```bash
cp backend/.env.example backend/.env
# Add OPENAI_API_KEY to .env
docker compose up --build
```
This boots up the FastAPI backend on `:8000` and Next.js frontend on `:3000`.

## 5. Adding New Features

If you are adding a new feature that interacts with the knowledge graph:
1. **Add Route**: Define a new endpoint in `backend/app/api/`.
2. **Service Layer**: Wrap Cognee interactions in `backend/app/services/` to abstract away vector/graph complexities.
3. **Frontend/Extension Integration**: Update the Next.js app or VS Code extension HTTP client (`extension/src/utils/apiClient.ts`) to consume the new route.
