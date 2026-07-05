# Dev-Context Assistant

Dev-Context Assistant is an intelligent VS Code extension that seamlessly captures your coding sessions, ingests them into the Cognee knowledge graph, and surfaces relevant memory exactly when you need it. It bridges the gap between your editor, debugging workflows, and open-source contributions.

## Features

- **Automated Memory Ingestion**: Automatically save context to Cognee on every file save (configurable).
- **Bug & Error Tracking**: Feeds active code and compilation errors (diagnostics) directly into your context graph.
- **Similar Bug Recall**: Highlight a bug or issue in your editor and instantly recall similar resolved issues from your history.
- **Issue Drafting**: Generate rich GitHub issue drafts containing stack traces, relevant files, and historical context with one click.
- **Secure Key Management**: Uses VS Code's native `SecretStorage` to securely hold your Cognee API keys and configuration.

## Setup & Configuration

1. Install the extension.
2. Open the Command Palette (`Ctrl+Shift+P` / `Cmd+Shift+P`).
3. Run **Set Cognee API Key** to authenticate your environment securely.
4. (Optional) Configure advanced settings in the VS Code Settings under `Dev-Context Assistant`:
   - Set custom similarity thresholds for bug recall.
   - Limit the maximum number of recall results.
   - Toggle the active file watcher and auto-save capabilities.

## Requirements

This extension requires a running instance of the Dev-Context Backend (built with FastAPI) and a valid Cognee configuration. 

## Commands

- `Save Current Context to Cognee` (`Ctrl+Shift+M`): Manually save your current active file context.
- `Recall Similar Bugs from Memory` (`Ctrl+Shift+R`): Search the knowledge graph for past solutions similar to your current context.
- `Draft GitHub Issue from Bug` (`Ctrl+Shift+I`): Generates an automated, contextual issue draft.
- `Save All Changed Files to Cognee` (`Ctrl+Shift+G`): Batches all unsaved/modified files into memory.

## Security

Your keys are never stored in plain text. We utilize the VS Code `SecretStorage` API to securely encrypt and store credentials locally.

---
Built with Cognee for the WeMakeDevs Hackathon.
