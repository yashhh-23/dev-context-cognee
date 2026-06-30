import * as vscode from 'vscode';
import { registerRememberContextCommand, ProviderBridge, StatusSetter } from './commands/rememberContext';
import { registerRecallBugsCommand } from './commands/recallBugs';
import { registerDraftIssueCommand } from './commands/draftIssue';

// ─── Sidebar WebView Provider ──────────────────────────────────────────────────
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

    /** Safe public bridge for commands — no private field access needed */
    postMessageToWebview(message: unknown): void {
        if (!this._view || !this.isOpen) { return; }
        this._view.webview.postMessage(message);
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

    // 3. Status + provider bridge for command modules
    const status: StatusSetter = {
        syncing: setStatusBarSyncing,
        done: setStatusBarDone,
        error: setStatusBarError
    };

    const bridge: ProviderBridge = {
        updateContextSummary: (doc) => provider.updateContextSummary(doc),
        postMessageToWebview: (msg) => provider.postMessageToWebview(msg)
    };

    // 4. Commands — now delegated to command modules
    context.subscriptions.push(
        registerRememberContextCommand(context, bridge, status),
        registerRecallBugsCommand(context, bridge, status),
        registerDraftIssueCommand(context, bridge, status)
    );

    // 5. File watcher: auto-refresh context on text change
    context.subscriptions.push(
        vscode.workspace.onDidChangeTextDocument(async (event) => {
            const watcherEnabled = vscode.workspace
                .getConfiguration('devContext')
                .get<boolean>('watcherEnabled', true);
            if (!watcherEnabled) { return; }
            if (event.document.uri.scheme !== 'file') { return; }
            if (provider.isOpen) {
                await provider.updateContextSummary(event.document);
            }
        })
    );

    // 6. Tab switch: refresh context when active editor changes
    context.subscriptions.push(
        vscode.window.onDidChangeActiveTextEditor(async (editor) => {
            if (editor && provider.isOpen) {
                await provider.updateContextSummary(editor.document);
            }
        })
    );

    // 7. Set extension context flag
    vscode.commands.executeCommand('setContext', 'devContext.enabled', true);

    console.log('Dev-Context Assistant: activated successfully');
}

// ─── Deactivate ────────────────────────────────────────────────────────────────
export function deactivate(): void {
    vscode.commands.executeCommand('setContext', 'devContext.enabled', false);
    console.log('Dev-Context Assistant: deactivated');
}
