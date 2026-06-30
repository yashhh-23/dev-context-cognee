import * as vscode from 'vscode';

// ─── Placeholder imports (filled in Groups 3–5) ───────────────────────────────
// These will be replaced with real imports once those files are pushed.
// For now, stub classes keep this file compilable standalone.

class DevContextWebViewProvider implements vscode.WebviewViewProvider {
    public static readonly viewType = 'devContextSidebar';
    private _view?: vscode.WebviewView;
    public isOpen = false;
    private _disposables: vscode.Disposable[] = [];

    constructor(private readonly _extensionUri: vscode.Uri) {}

    resolveWebviewView(
        webviewView: vscode.WebviewView,
        _context: vscode.WebviewViewResolveContext,
        _token: vscode.CancellationToken
    ): void {
        this._view = webviewView;
        this.isOpen = true;

        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [this._extensionUri]
        };

        // Placeholder HTML — replaced in Group 5
        webviewView.webview.html = this._getPlaceholderHtml();

        // Track disposal
        webviewView.onDidDispose(() => {
            this.isOpen = false;
            this.dispose();
        }, null, this._disposables);
    }

    async updateContextSummary(document?: vscode.TextDocument): Promise<void> {
        if (!this._view || !document || !this.isOpen) { return; }
        const config = vscode.workspace.getConfiguration('devContext');
        if (!config.get<boolean>('watcherEnabled', true)) { return; }

        this._view.webview.postMessage({
            type: 'contextUpdate',
            context: {
                fileName: vscode.workspace.asRelativePath(document.fileName),
                languageId: document.languageId,
                lineCount: document.lineCount,
                isDirty: document.isDirty
            }
        });
    }

    private _getPlaceholderHtml(): string {
        return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body {
      background: #0d0d0d;
      color: #e5e5e5;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      padding: 16px;
      margin: 0;
    }
    .logo { font-size: 18px; font-weight: 600; margin-bottom: 8px; }
    .sub  { font-size: 12px; color: #666; margin-bottom: 24px; }
    .card {
      background: #1a1a1a;
      border: 1px solid #2a2a2a;
      border-radius: 8px;
      padding: 14px;
      margin-bottom: 12px;
    }
    .label { font-size: 11px; color: #888; text-transform: uppercase; letter-spacing: 0.05em; }
    .hint  { font-size: 12px; color: #aaa; margin-top: 6px; line-height: 1.5; }
    .kbd {
      background: #2a2a2a;
      border: 1px solid #444;
      border-radius: 4px;
      padding: 2px 6px;
      font-size: 11px;
      font-family: monospace;
    }
    .status { display: flex; align-items: center; gap: 6px; font-size: 11px; color: #888; margin-top: 20px; }
    .dot { width: 7px; height: 7px; border-radius: 50%; background: #22c55e; }
  </style>
</head>
<body>
  <div class="logo">Dev-Context Assistant</div>
  <div class="sub">Cognee-powered memory for developers</div>

  <div class="card">
    <div class="label">Save Context</div>
    <div class="hint">Open any file, then press <span class="kbd">Ctrl+Shift+M</span> to save current context to Cognee memory.</div>
  </div>

  <div class="card">
    <div class="label">Recall Similar Bugs</div>
    <div class="hint">Press <span class="kbd">Ctrl+Shift+R</span> to recall similar past bugs from Cognee memory for the current file.</div>
  </div>

  <div class="card">
    <div class="label">Draft GitHub Issue</div>
    <div class="hint">Press <span class="kbd">Ctrl+Shift+I</span> to auto-draft a GitHub issue from a recalled bug.</div>
  </div>

  <div class="status">
    <div class="dot"></div>
    <span>Sidebar active — full UI coming in next build</span>
  </div>
</body>
</html>`;
    }

    dispose(): void {
        this._disposables.forEach(d => d.dispose());
        this._disposables = [];
    }
}

// ─── Status Bar ────────────────────────────────────────────────────────────────
let statusBarItem: vscode.StatusBarItem;

function createStatusBar(): vscode.StatusBarItem {
    const item = vscode.window.createStatusBarItem(
        vscode.StatusBarAlignment.Right,
        100
    );
    item.text = '$(brain) Cognee';
    item.tooltip = 'Dev-Context Assistant — click to open sidebar';
    item.command = 'workbench.view.extension.devContextContainer';
    item.show();
    return item;
}

function setStatusBarSyncing(): void {
    if (!statusBarItem) { return; }
    statusBarItem.text = '$(sync~spin) Cognee';
}

function setStatusBarDone(message = 'Cognee'): void {
    if (!statusBarItem) { return; }
    statusBarItem.text = `$(brain) ${message}`;
    setTimeout(() => {
        if (statusBarItem) { statusBarItem.text = '$(brain) Cognee'; }
    }, 3000);
}

function setStatusBarError(): void {
    if (!statusBarItem) { return; }
    statusBarItem.text = '$(error) Cognee';
    setTimeout(() => {
        if (statusBarItem) { statusBarItem.text = '$(brain) Cognee'; }
    }, 4000);
}

// ─── Guards ────────────────────────────────────────────────────────────────────
function getBackendUrl(): string | null {
    const url = vscode.workspace
        .getConfiguration('devContext')
        .get<string>('backendUrl', '');
    if (!url || url === 'https://your-backend.onrender.com') {
        vscode.window.showErrorMessage(
            'Dev-Context: Backend URL not configured. Go to Settings → Dev-Context Assistant → Backend URL.'
        );
        return null;
    }
    return url;
}

function requireActiveEditor(): vscode.TextEditor | null {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
        vscode.window.showWarningMessage(
            'Dev-Context: No active file open. Open a file first.'
        );
        return null;
    }
    return editor;
}

function requireWorkspace(): boolean {
    if (!vscode.workspace.workspaceFolders?.length) {
        vscode.window.showErrorMessage(
            'Dev-Context: No workspace folder open. Open a project folder first.'
        );
        return false;
    }
    return true;
}

// ─── Activate ──────────────────────────────────────────────────────────────────
export function activate(context: vscode.ExtensionContext): void {
    console.log('Dev-Context Assistant: activating...');

    // 1. Status bar
    statusBarItem = createStatusBar();
    context.subscriptions.push(statusBarItem);

    // 2. Sidebar WebView provider
    const provider = new DevContextWebViewProvider(context.extensionUri);
    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider(
            DevContextWebViewProvider.viewType,
            provider,
            { webviewOptions: { retainContextWhenHidden: true } }
        )
    );

    // 3. Command: Save Current Context to Cognee
    context.subscriptions.push(
        vscode.commands.registerCommand('devContext.rememberContext', async () => {
            const editor = requireActiveEditor();
            if (!editor) { return; }
            if (!requireWorkspace()) { return; }
            const backendUrl = getBackendUrl();
            if (!backendUrl) { return; }

            setStatusBarSyncing();
            try {
                const response = await fetch(`${backendUrl}/api/ingest`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        content: editor.document.getText(),
                        fileName: vscode.workspace.asRelativePath(editor.document.fileName),
                        languageId: editor.document.languageId,
                        source: 'vscode-extension'
                    })
                });

                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }

                setStatusBarDone('Saved ✓');
                vscode.window.showInformationMessage(
                    `Dev-Context: Context saved to Cognee (${editor.document.languageId})`
                );
                await provider.updateContextSummary(editor.document);
            } catch (err: unknown) {
                setStatusBarError();
                const msg = err instanceof Error ? err.message : String(err);
                vscode.window.showErrorMessage(`Dev-Context: Failed to save context — ${msg}`);
            }
        })
    );

    // 4. Command: Recall Similar Bugs
    context.subscriptions.push(
        vscode.commands.registerCommand('devContext.recallSimilarBugs', async () => {
            const editor = requireActiveEditor();
            if (!editor) { return; }
            const backendUrl = getBackendUrl();
            if (!backendUrl) { return; }

            const threshold = vscode.workspace
                .getConfiguration('devContext')
                .get<number>('similarityThreshold', 0.75);

            setStatusBarSyncing();
            try {
                const response = await fetch(`${backendUrl}/api/memory/recall`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        query: editor.document.getText().slice(0, 2000),
                        languageId: editor.document.languageId,
                        similarityThreshold: threshold
                    })
                });

                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }

                const data = await response.json() as { bugs?: unknown[] };
                const bugCount = data.bugs?.length ?? 0;

                setStatusBarDone(`${bugCount} bug(s) recalled`);
                vscode.window.showInformationMessage(
                    bugCount > 0
                        ? `Dev-Context: ${bugCount} similar bug(s) recalled — check sidebar`
                        : 'Dev-Context: No similar bugs found in memory'
                );

                // Push results to sidebar
                provider['_view']?.webview.postMessage({
                    type: 'bugsUpdate',
                    bugs: data.bugs ?? []
                });
            } catch (err: unknown) {
                setStatusBarError();
                const msg = err instanceof Error ? err.message : String(err);
                vscode.window.showErrorMessage(`Dev-Context: Recall failed — ${msg}`);
            }
        })
    );

    // 5. Command: Draft GitHub Issue
    context.subscriptions.push(
        vscode.commands.registerCommand('devContext.draftGitHubIssue', async () => {
            const editor = requireActiveEditor();
            if (!editor) { return; }
            const backendUrl = getBackendUrl();
            if (!backendUrl) { return; }

            setStatusBarSyncing();
            try {
                const response = await fetch(`${backendUrl}/api/bugs/draft-issue`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        fileName: vscode.workspace.asRelativePath(editor.document.fileName),
                        languageId: editor.document.languageId,
                        codeSnippet: editor.document.getText(editor.selection) ||
                                     editor.document.getText().slice(0, 1500)
                    })
                });

                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }

                const data = await response.json() as { title?: string; body?: string };
                const issueTitle = data.title ?? 'Bug Report';
                const issueBody  = data.body  ?? 'No details returned.';

                // Open draft in a new editor tab
                const doc = await vscode.workspace.openTextDocument({
                    language: 'markdown',
                    content: `# ${issueTitle}\n\n${issueBody}\n`
                });
                await vscode.window.showTextDocument(doc, vscode.ViewColumn.Beside);

                setStatusBarDone('Issue drafted ✓');
                vscode.window.showInformationMessage(
                    'Dev-Context: GitHub issue draft opened — review and submit manually'
                );
            } catch (err: unknown) {
                setStatusBarError();
                const msg = err instanceof Error ? err.message : String(err);
                vscode.window.showErrorMessage(`Dev-Context: Draft failed — ${msg}`);
            }
        })
    );

    // 6. File watcher: auto-refresh context on text change
    context.subscriptions.push(
        vscode.workspace.onDidChangeTextDocument(async (event) => {
            const watcherEnabled = vscode.workspace
                .getConfiguration('devContext')
                .get<boolean>('watcherEnabled', true);
            if (!watcherEnabled) { return; }
            if (event.document.uri.scheme !== 'file') { return; }  // Ignore output/git panels
            if (provider.isOpen) {
                await provider.updateContextSummary(event.document);
            }
        })
    );

    // 7. Tab switch: refresh context when active editor changes
    context.subscriptions.push(
        vscode.window.onDidChangeActiveTextEditor(async (editor) => {
            if (editor && provider.isOpen) {
                await provider.updateContextSummary(editor.document);
            }
        })
    );

    // 8. Set extension context flag
    vscode.commands.executeCommand('setContext', 'devContext.enabled', true);

    console.log('Dev-Context Assistant: activated successfully');
}

// ─── Deactivate ────────────────────────────────────────────────────────────────
export function deactivate(): void {
    vscode.commands.executeCommand('setContext', 'devContext.enabled', false);
    console.log('Dev-Context Assistant: deactivated');
}
