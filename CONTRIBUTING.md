# Contributing to Dev-Context Assistant

First off, thank you for considering contributing to **Dev-Context Assistant**! 🎉
This project was built during the WeMakeDevs Cognee Hackathon. We welcome contributions from everyone—whether it's fixing bugs, improving documentation, adding new features, or creating new integrations.

The following is a set of guidelines for contributing to this project. These are mostly guidelines, not rules. Use your best judgment, and feel free to propose changes to this document in a pull request.

---

## 🏗 Project Architecture
Before diving in, it helps to understand the structure of the repository. This is a monorepo consisting of several distinct parts:

- **`/backend`**: The FastAPI server that handles communication with the Cognee knowledge graph and stores sessions.
- **`/frontend`**: The Next.js dashboard UI for visualizing the graph and managing the context.
- **`/extension`**: The VS Code extension that automatically watches files and feeds developer context to the backend.
- **`/mcp`**: A Model Context Protocol server that exposes Cognee's memory capabilities as tools to clients like Claude Desktop and Cursor.
- **`/cli`**: Command-line tools for manual ingestion and interaction.

---

## 🛠 Setup for Local Development

To contribute to a specific component, you'll need to set it up locally. 

### 1. Backend (FastAPI + Cognee)
1. Navigate to the backend folder: `cd backend`
2. Set up a Python virtual environment: `python -m venv venv`
3. Activate the environment: 
   - Windows: `venv\Scripts\activate`
   - Mac/Linux: `source venv/bin/activate`
4. Install dependencies: `pip install -r requirements.txt`
5. Create a `.env` file (copy `.env.example` if it exists) and add your `COGNEE_API_KEY` and `COGNEE_TENANT_URL`.
6. Run the server: `uvicorn app.main:app --reload` (Runs on port `8000`)

### 2. Frontend (Next.js)
1. Navigate to the frontend folder: `cd frontend`
2. Install dependencies: `npm install`
3. Run the development server: `npm run dev` (Runs on port `3000`)

### 3. VS Code Extension
1. Navigate to the extension folder: `cd extension`
2. Install dependencies: `npm install`
3. Open the `extension` folder in VS Code.
4. Press `F5` to open a new VS Code window with the extension loaded in debug mode.
5. To package it manually, run: `npm run package` (Generates a `.vsix` file).

---

## 💡 How You Can Contribute

### For Hackathon Participants / Judges
- **Feedback & Issues**: If you run into any issues during the demo or while testing the app, please open an issue! 
- **Documentation**: Spot a typo in the README? Want to add a clearer explanation of how the Cognee integration works? Documentation PRs are always welcome.

### For Open Source Contributors
- **New Features**: Have an idea for a new feature? We'd love to hear it. Please open an issue first to discuss it before spending time writing code.
- **Bug Fixes**: Check the GitHub Issues tab for anything labeled `bug` or `good first issue`.
- **UI/UX Improvements**: The Next.js frontend and VS Code sidebar can always use polish. Feel free to submit design tweaks!
- **MCP Tool Expansion**: Add new capabilities to the Claude Desktop MCP server in the `/mcp` directory.

---

## 📝 Submitting a Pull Request (PR)

1. **Fork the repository** on GitHub.
2. **Clone your fork** locally: `git clone https://github.com/YOUR_USERNAME/dev-context-cognee.git`
3. **Create a new branch** for your feature or bugfix: `git checkout -b feature/your-feature-name` or `fix/your-bug-fix`.
4. **Make your changes** and test them locally.
5. **Commit your changes**: Write clear, descriptive commit messages.
   ```bash
   git commit -m "feat: add automatic bug linking in extension"
   ```
6. **Push to your fork**: `git push origin feature/your-feature-name`
7. **Open a Pull Request** against the `main` branch of the original repository.
   - Provide a clear title and description of what your PR solves.
   - Link to any relevant issues (e.g., "Fixes #12").

---

## 🐛 Reporting Bugs

If you find a bug, please create a GitHub Issue with the following information:
1. A clear, descriptive title.
2. Steps to reproduce the behavior.
3. Expected behavior vs. what actually happened.
4. Environment details (OS, VS Code version, Python/Node versions).
5. Screenshots or logs if applicable.

---

## 🤝 Code of Conduct

We expect all contributors to be respectful, inclusive, and collaborative. Any harassment, trolling, or toxic behavior will not be tolerated. Let's build a great tool together!

---
*Thank you for contributing to Dev-Context Assistant and supporting our WeMakeDevs Hackathon submission!* 🚀
