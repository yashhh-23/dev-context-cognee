# Dev Context Cognee

A full-stack context ingestion and memory search tool using **Cognee**, **FastAPI**, and **Next.js**, equipped with a **VS Code Extension** for rapid context syncing.

## Architecture

1. **VS Code Extension / CLI**: Captures your terminal output and current codebase context.
2. **FastAPI Backend**: Redacts secrets, cleans logs, and wraps the Cognee memory SDK.
3. **Cognee Knowledge Graph**: Cognifies the text into structured nodes.
4. **Next.js Dashboard**: Visualizes your ingestion history and queries the knowledge graph.

## Quick Start

1. Start the stack:
   ```bash
   docker-compose up --build
   ```
2. Open the dashboard at [http://localhost:3000](http://localhost:3000)
3. Send logs using the CLI:
   ```bash
   echo "My log content" | python cli/cognee_cli.py
   ```
4. Or use the VS Code Extension (`cognee.sendToMemory` command).
