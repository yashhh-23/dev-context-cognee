# Product Requirements Document (PRD)
## dev·context — AI Memory for Developer Workflows

### 1. Overview
`dev·context` is a persistent memory and context engine built specifically for software developers. Utilizing Cognee's knowledge graph infrastructure, it continuously tracks and ingests the developer's coding sessions, bugs, and context into an easily retrievable memory graph. This significantly reduces cognitive load by enabling context-aware issue drafting and similar-bug recall directly within the IDE.

### 2. Problem Statement
Developers frequently lose context when switching between tasks, encountering recurring bugs, or drafting GitHub issues. Reconstructing the environment and identifying what went wrong is time-consuming. Existing IDE tools lack persistent, graph-based memory linking past coding sessions to current problems.

### 3. Target Audience
- Software engineers working on complex, multi-file codebases.
- Open-source contributors who need to rapidly triage and draft issues.
- Teams seeking to centralize implicit knowledge of past bugs and architectural decisions.

### 4. Key Features & Requirements

**4.1. Intelligent Context Ingestion**
- Users must be able to save their active file and relevant symbols via a single IDE command (`Cmd+Shift+M`).
- System will asynchronously parse and convert this code state into vector embeddings and knowledge graph nodes (via Cognee).

**4.2. Contextual Bug Recall**
- Users can highlight a code snippet or error and trigger a recall (`Cmd+Shift+R`).
- System will query the vector store and graph to surface past sessions, related bugs, and relevant historical context with similarity scores.

**4.3. Automated GitHub Issue Drafting**
- Users can automatically generate structured GitHub issues based on current errors (`Cmd+Shift+I`).
- System will utilize the recalled memory and an LLM to pre-fill descriptions, reproduction steps, and potential resolutions.

**4.4. Memory Visualization & Management**
- Provide a Next.js-based dashboard to visualize the knowledge graph and key metrics.
- Allow developers to manually forget (delete) irrelevant nodes or explicitly memify (store) important manual notes.

**4.5. Ubiquitous Access (Integrations)**
- A VS Code Extension acting as the primary input/output interface.
- A CLI for headless ingestion.
- An MCP Server for exposing Cognee memory to AI assistants like Claude Desktop, Cursor, or Cline.

### 5. Technical Stack
- **Backend Core**: Python, FastAPI, SQLAlchemy, Uvicorn.
- **AI & Graph**: Cognee, LanceDB (Vector DB), LLM Integrations (OpenAI/Anthropic).
- **Frontend**: Next.js Dashboard.
- **Extension**: TypeScript, VS Code API.
- **Deployment**: Docker Compose for local provisioning.

### 6. Success Metrics
- Reduction in time spent drafting comprehensive bug reports.
- Increased discovery of past similar bugs before diving into redundant debugging.
- Minimal latency for ingestion and recall queries (< 2 seconds per operation).
