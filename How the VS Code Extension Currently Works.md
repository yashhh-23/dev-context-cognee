
## How the VS Code Extension Currently Works

Here's the complete architecture at a glance:

```
extension/
├── src/
│   ├── extension.ts          ← Entry point, registers everything
│   ├── provider.ts           ← 612-line WebView sidebar (all UI lives here)
│   ├── commands/
│   │   ├── rememberContext.ts  ← Ctrl+Shift+M → POST /api/ingest
│   │   ├── recallBugs.ts       ← Ctrl+Shift+R → POST /api/recall
│   │   └── draftIssue.ts       ← Ctrl+Shift+I → POST /api/bugs/draft-issue
│   └── utils/
│       ├── apiClient.ts        ← Fetch wrapper + Bearer token injection
│       ├── languageDetector.ts ← Regex-based symbol/import extraction
│       └── tokenManager.ts     ← SecretStorage API for API key
```


### What each piece does

**`rememberContext.ts`** — On `Ctrl+Shift+M`:[^3]

- Takes the **entire active file's text** + relative path + languageId
- Calls `summarizeDocumentStructure()` (counts imports, symbols, lines via regex)
- POSTs it to `/api/ingest` → backend calls `cognee.add()` + `cognee.cognify()`

**`recallBugs.ts`** — On `Ctrl+Shift+R`:[^4]

- If user has text selected → uses selection as query
- Else builds fallback: `languageName + top 8 symbols + top 6 imports + first 1500 chars`
- POSTs to `/api/recall` → backend does `cognee.search(SIMILARITY)`
- Results sent back as `bugsUpdate` message → rendered as cards in sidebar

**`draftIssue.ts`** — On `Ctrl+Shift+I`:[^5]

- Sends file path + languageId + selected code (or first 2000 chars)
- Backend uses recalled context + `cognee.llm_query()` to generate a GitHub issue title + body
- Opens a **Markdown tab beside the editor** for the user to review

**`provider.ts`** — The sidebar WebView:[^6]

- Pure HTML/CSS/JS string injected into a VS Code WebviewView
- Has: header, context bar (active file name/lang/lines), 3 action buttons, recalled bugs list, last-saved info, status toast, offline indicator
- Two-way message channel: TypeScript ↔ WebView via `postMessage`

**`apiClient.ts`** — Utility class:[^7]

- Reads backend URL from VS Code settings (`devContext.backendUrl`)
- Injects `Authorization: Bearer <key>` from SecretStorage
- Auto-retries once on 401 by prompting for new API key

***

## Current Weaknesses / What's Missing

| Problem | Impact |
| :-- | :-- |
| `rememberContext` is **manual** — user must press `Ctrl+Shift+M` | Developers forget to save context; memory is sparse |
| **No session lifecycle** — nothing happens on open/close of VS Code | No `SessionStart`/`SessionEnd` hooks, Cognee's `session_lifecycle` module unused |
| **No `improve()` / feedback** in extension | Missing mandatory lifecycle operation |
| Recall is **file-scoped** — only the open file's content is the query | Cross-file bugs (e.g. error in file A caused by file B) never found |
| **No inline decorations** — recalled results exist only in sidebar | Developer must context-switch to sidebar while debugging |
| `summarizeDocumentStructure()` uses regex for symbols | VS Code has a native Symbols API (`vscode.executeDocumentSymbolProvider`) that's far more accurate |
| **No diagnostic integration** — errors shown in Problems panel never fed to Cognee | The most valuable context (actual errors) is ignored |
| Sidebar is **all raw HTML string in provider.ts** (612 lines!) | Unmaintainable, no component structure, no styling framework |
| `draftIssue` only creates a local Markdown tab | No one-click push to GitHub |
| **No WebSocket connection** — live memory events from backend never reach extension | The `ws.ts` in the frontend exists but extension doesn't use it |


***

## Improvements \& Implementation Steps

### 1. Auto-Save Context on File Save (Passive Memory)

**The Problem:** Memory only gets saved when someone presses `Ctrl+Shift+M`. Most developers won't remember.

**The Fix:** Hook into `onDidSaveTextDocument` to silently ingest on every save.

**Implementation in `extension.ts`:**

```typescript
// Add to activate()
const autoSaveDisposable = vscode.workspace.onDidSaveTextDocument(async (document) => {
  const config = vscode.workspace.getConfiguration('devContext');
  if (!config.get<boolean>('autoSaveOnFileSave', true)) return;
  if (!isSupportedLanguage(document.languageId)) return;
  
  const api = new ApiClient({ context });
  await api.ingestContext({
    content: document.getText(),
    fileName: vscode.workspace.asRelativePath(document.fileName),
    languageId: document.languageId,
    source: 'auto-save'
  });
  // silent — no popup, just update status bar briefly
  statusBarItem.text = '$(check) Cognee ✓';
  setTimeout(() => statusBarItem.text = '$(brain) Cognee', 2000);
});
context.subscriptions.push(autoSaveDisposable);
```

**Add setting in `package.json`:**

```json
{ "devContext.autoSaveOnFileSave": { "type": "boolean", "default": true, "description": "Automatically save context to Cognee on every file save" } }
```


***

### 2. Session Lifecycle — Start / End Session with Distillation

**The Problem:** No `SessionStart`/`SessionEnd` hooks. Cognee's `session_distillation` module is completely unused.

**Implementation — add two new commands + lifecycle hooks:**

**In `extension.ts` activate():**

```typescript
// Session Start — fires on VS Code startup
const sessionId = `session_${Date.now()}_${vscode.env.machineId.slice(0,8)}`;
context.globalState.update('currentSessionId', sessionId);
await api.startSession({ sessionId, workspaceName: vscode.workspace.name });

// Session End — fires on deactivate
context.subscriptions.push(
  new vscode.Disposable(async () => {
    await api.endSession({ 
      sessionId: context.globalState.get('currentSessionId'),
      triggerDistillation: true  // ← calls Cognee session_distillation
    });
  })
);
```

**New backend endpoint `POST /api/session/end`:**

```python
# In backend/app/api/lifecycle.py
from cognee.modules.session_distillation import distill

@router.post("/session/end")
async def end_session(session_id: str, trigger_distillation: bool = True):
    if trigger_distillation:
        await distill(session_id=session_id)  # LLM curates learnings → permanent graph
    return {"status": "distilled"}
```

**In the sidebar**, show a "End Session \& Distill" button that triggers this with a progress indicator: *"Extracting lessons from your session..."*

***

### 3. Inline Code Decorations for Recalled Bugs

**The Problem:** Recalled results are buried in the sidebar. Developers look at code, not sidebars.

**Implementation — use VS Code Decoration API:**

```typescript
// In a new file: extension/src/decorations/bugDecorator.ts
import * as vscode from 'vscode';

const bugDecorationType = vscode.window.createTextEditorDecorationType({
  after: {
    contentText: ' ⚠ Similar bug recalled',
    color: '#f59e0b',
    fontStyle: 'italic',
    fontSize: '11px'
  },
  backgroundColor: 'rgba(245, 158, 11, 0.08)',
  borderRadius: '3px'
});

export function applyBugDecorations(
  editor: vscode.TextEditor, 
  bugs: RecalledBug[]
) {
  const decorations: vscode.DecorationOptions[] = [];
  
  bugs.forEach(bug => {
    if (!bug.lineHint) return;
    const line = editor.document.lineAt(bug.lineHint - 1);
    decorations.push({
      range: line.range,
      hoverMessage: new vscode.MarkdownString(
        `**Recalled Memory** (${(bug.score * 100).toFixed(0)}% match)\n\n${bug.summary}\n\n*From: ${bug.sourceFile}*`
      )
    });
  });
  
  editor.setDecorations(bugDecorationType, decorations);
}
```

Hovering the highlighted line shows the recalled memory in a tooltip. No sidebar needed.

***

### 4. Diagnostic Integration — Feed VS Code Errors to Cognee

**The Problem:** The Problems panel (red squiggles, TypeScript errors, ESLint warnings) is the richest debugging context that exists — and it's never sent to Cognee.

**Implementation — hook `onDidChangeDiagnostics`:**

```typescript
// In extension.ts activate()
vscode.languages.onDidChangeDiagnostics(async (event) => {
  for (const uri of event.uris) {
    const diagnostics = vscode.languages.getDiagnostics(uri);
    const errors = diagnostics.filter(d => d.severity === vscode.DiagnosticSeverity.Error);
    if (errors.length === 0) continue;
    
    const editor = vscode.window.visibleTextEditors.find(e => e.document.uri.toString() === uri.toString());
    
    await api.ingestContext({
      content: errors.map(e => `[${e.source}] Line ${e.range.start.line + 1}: ${e.message}`).join('\n'),
      fileName: vscode.workspace.asRelativePath(uri.fsPath),
      languageId: editor?.document.languageId ?? 'unknown',
      source: 'diagnostics',  // ← tagged differently from manual saves
      metadata: { errorCount: errors.length }
    });
  }
});
```

Now when a TypeScript error fires, it's automatically ingested into Cognee's graph. Next time a similar error occurs in any file, recall surfaces it instantly.

***

### 5. Memory Feedback (Thumbs Up/Down) in Sidebar

**The Problem:** `improve()` lifecycle is not implemented anywhere. This is a hard judging requirement.

**Implementation — add feedback buttons to each bug card in `provider.ts`:**

In the HTML for each bug card, add:

```html
<div class="feedback-row">
  <button class="feedback-btn up" data-qa-id="${bug.qaId}" data-score="1">👍 Helpful</button>
  <button class="feedback-btn down" data-qa-id="${bug.qaId}" data-score="-1">👎 Not relevant</button>
</div>
```

In the WebView JS message listener:

```javascript
document.querySelectorAll('.feedback-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    vscode.postMessage({
      type: 'submitFeedback',
      qaId: btn.dataset.qaId,
      score: parseInt(btn.dataset.score)
    });
    btn.textContent = btn.dataset.score === '1' ? '✓ Thanks!' : '✓ Noted';
    btn.disabled = true;
  });
});
```

In `provider.ts` message handler:

```typescript
case 'submitFeedback':
  await api.submitFeedback({ qaId: message.qaId, score: message.score });
  break;
```

**New backend endpoint `POST /api/recall/feedback`:**

```python
@router.post("/recall/feedback")
async def submit_feedback(qa_id: str, score: int):
    await cognee.session.add_feedback(qa_id=qa_id, score=score)
    # score=1 → improve(), score=-1 → candidate for forget()
    if score == 1:
        await cognee.improve(node_id=qa_id)
    return {"status": "ok"}
```


***

### 6. Use Native VS Code Symbol Provider (Replace Regex)

**The Problem:** `languageDetector.ts` uses hardcoded regex patterns to extract imports and function names. VS Code has a native, language-server-backed symbol provider.

**Replace in `rememberContext.ts`:**

```typescript
// BEFORE (fragile regex)
const summary = summarizeDocumentStructure(document); // regex-based

// AFTER (native VS Code API — works for ALL languages)
const symbols = await vscode.commands.executeCommand<vscode.DocumentSymbol[]>(
  'vscode.executeDocumentSymbolProvider',
  document.uri
);

const symbolNames = symbols?.flatMap(s => [
  s.name, 
  ...s.children.map(c => c.name)
]) ?? [];

await api.ingestContext({
  content: document.getText(),
  fileName: vscode.workspace.asRelativePath(document.fileName),
  languageId: document.languageId,
  symbols: symbolNames,         // ← accurate, LSP-backed symbol list
  source: 'vscode-extension'
});
```

This means Java, Go, Rust, C\# — every language with an LSP — gets accurate symbol extraction, not just the 5 hardcoded in regex.

***

### 7. Multi-File Context (Git-Changed Files)

**The Problem:** Only the currently open file is ingested. But a bug fix often spans multiple files.

**Implementation — new command `devContext.rememberChangedFiles`:**

```typescript
// Get all git-modified files using VS Code's built-in Git extension
const gitExtension = vscode.extensions.getExtension('vscode.git')?.exports;
const repo = gitExtension?.getAPI(1)?.repositories[^0];
const changedFiles = repo?.state.workingTreeChanges ?? [];

for (const change of changedFiles.slice(0, 10)) { // cap at 10
  const doc = await vscode.workspace.openTextDocument(change.uri);
  await api.ingestContext({
    content: doc.getText(),
    fileName: vscode.workspace.asRelativePath(change.uri),
    languageId: doc.languageId,
    source: 'git-changes',
    metadata: { gitStatus: change.status }
  });
}
```

Add keybinding: `Ctrl+Shift+G` — "Save all changed files to Cognee". Perfect for pre-commit context capture.

***

### 8. Sidebar Refactor — React WebView

**The Problem:** `provider.ts` is a 612-line file containing a raw HTML string. This is impossible to maintain and extend.

**Migration path:**

```
extension/
├── src/
│   ├── extension.ts
│   ├── provider.ts          ← thin shell, just loads webview
│   └── webview/             ← NEW: React app compiled separately
│       ├── App.tsx
│       ├── components/
│       │   ├── ContextBar.tsx
│       │   ├── BugCard.tsx       ← with feedback buttons
│       │   ├── SessionPanel.tsx  ← session start/end/distill
│       │   ├── MemoryFeed.tsx    ← live WebSocket memory events
│       │   └── ChatQuery.tsx     ← natural language memory query
│       └──