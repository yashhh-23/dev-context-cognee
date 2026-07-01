import * as vscode from 'vscode';
import { ApiClient } from './utils/apiClient';

export class DevContextWebViewProvider implements vscode.WebviewViewProvider {
    public static readonly viewType = 'devContextSidebar';
    private _view?: vscode.WebviewView;
    public isOpen = false;
    private _disposables: vscode.Disposable[] = [];

    constructor(
        private readonly _extensionUri: vscode.Uri,
        private readonly _context: vscode.ExtensionContext
    ) {}

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

        webviewView.webview.html = this._getHtml();

        const api = new ApiClient({ context: this._context });
        webviewView.webview.onDidReceiveMessage(
            (message: { type?: string; command?: string; payload?: any; qaId?: string; score?: number }) => {
                const action = message.type || message.command;
                switch (action) {
                    case 'copyToClipboard':
                        vscode.env.clipboard.writeText(String(message.payload ?? ''))
                            .then(() => vscode.window.showInformationMessage('Dev-Context: Copied to clipboard.'));
                        break;
                    case 'openSettings':
                        vscode.commands.executeCommand('workbench.action.openSettings', 'devContext');
                        break;
                    case 'runRemember':
                        vscode.commands.executeCommand('devContext.rememberContext');
                        break;
                    case 'runRecall':
                        vscode.commands.executeCommand('devContext.recallSimilarBugs');
                        break;
                    case 'runDraft':
                        vscode.commands.executeCommand('devContext.draftGitHubIssue');
                        break;
                    case 'runImprove':
                        vscode.commands.executeCommand('devContext.improveContext');
                        break;
                    case 'runForget':
                        vscode.commands.executeCommand('devContext.forgetContext');
                        break;
                    case 'openFile':
                        if (message.payload) {
                            vscode.workspace.findFiles(`**/${message.payload}`, undefined, 1)
                                .then(uris => {
                                    if (uris.length > 0) {
                                        vscode.window.showTextDocument(uris[0]);
                                    } else {
                                        vscode.window.showWarningMessage(`Dev-Context: File not found — ${message.payload}`);
                                    }
                                });
                        }
                        break;
                    case 'submitFeedback':
                        const currentSession = this._context.globalState.get<string>('currentSessionId') || '';
                        api.submitFeedback({
                            qaId: message.qaId || (message.payload && message.payload.qaId),
                            score: message.score || (message.payload && message.payload.score),
                            sessionId: currentSession
                        }).then(() => {
                            this.postMessageToWebview({
                                type: 'feedbackSuccess',
                                payload: {
                                    qaId: message.qaId || (message.payload && message.payload.qaId),
                                    score: message.score || (message.payload && message.payload.score)
                                }
                            });
                        }).catch(err => {
                            vscode.window.showErrorMessage(`Dev-Context: Failed to submit feedback — ${err.message}`);
                        });
                        break;
                    case 'endSession':
                        vscode.window.withProgress({
                            location: vscode.ProgressLocation.Notification,
                            title: 'Dev-Context: Distilling session memories...',
                            cancellable: false
                        }, async () => {
                            try {
                                const curSession = this._context.globalState.get<string>('currentSessionId') || '';
                                await api.endSession({ sessionId: curSession, triggerDistillation: true });
                                const newSessionId = `session_${Date.now()}_${vscode.env.machineId.slice(0, 8)}`;
                                this._context.globalState.update('currentSessionId', newSessionId);
                                await api.startSession({ sessionId: newSessionId, workspaceName: vscode.workspace.name || 'unnamed-workspace' });
                                vscode.window.showInformationMessage('Dev-Context: Session distilled and restarted successfully!');
                            } catch (err: any) {
                                vscode.window.showErrorMessage(`Dev-Context: Distill failed — ${err.message}`);
                            }
                        });
                        break;
                }
            },
            null,
            this._disposables
        );

        webviewView.onDidDispose(() => {
            this.isOpen = false;
            this.dispose();
        }, null, this._disposables);

        setTimeout(() => {
            const doc = vscode.window.activeTextEditor?.document || vscode.window.visibleTextEditors[0]?.document;
            if (doc) { this.updateContextSummary(doc); }
        }, 300);
    }

    async updateContextSummary(document?: vscode.TextDocument): Promise<void> {
        if (!document) {
            document = vscode.window.activeTextEditor?.document || vscode.window.visibleTextEditors[0]?.document;
        }
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

    postMessageToWebview(message: unknown): void {
        if (!this._view || !this.isOpen) { return; }
        this._view.webview.postMessage(message);
    }

    private _getHtml(): string {
        return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline';">
  <title>Dev-Context Assistant</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    :root {
      --bg: #0d0d0d; --surface: #141414; --surface2: #1c1c1c;
      --border: #2a2a2a; --text: #e2e2e2; --muted: #888; --faint: #444;
      --accent: #4f98a3; --accent-dim: #2a4a50;
      --success: #22c55e; --warning: #f59e0b; --error: #ef4444;
      --radius: 8px; --radius-sm: 5px;
    }
    html, body { background: var(--bg); color: var(--text); font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; font-size: 12px; line-height: 1.5; height: 100%; overflow-x: hidden; }
    .shell { display: flex; flex-direction: column; min-height: 100vh; padding: 12px 10px 20px; gap: 10px; }

    /* Header */
    .header { display: flex; align-items: center; justify-content: space-between; padding-bottom: 8px; border-bottom: 1px solid var(--border); }
    .header-left { display: flex; align-items: center; gap: 7px; }
    .logo-icon { width: 22px; height: 22px; background: var(--accent-dim); border: 1px solid var(--accent); border-radius: 6px; display: flex; align-items: center; justify-content: center; font-size: 13px; }
    .logo-text { font-size: 13px; font-weight: 600; color: var(--text); }
    .logo-sub  { font-size: 10px; color: var(--muted); margin-top: 1px; }
    .header-right { display: flex; align-items: center; gap: 5px; }
    .score-badge { font-size: 10px; color: #4ade80; background: #1a2e1a; border: 1px solid #2a4a2a; border-radius: 99px; padding: 2px 8px; font-weight: 600; white-space: nowrap; }
    .icon-btn { background: none; border: none; cursor: pointer; color: var(--muted); font-size: 14px; padding: 3px 5px; border-radius: var(--radius-sm); transition: color 120ms, background 120ms; }
    .icon-btn:hover { color: var(--text); background: var(--surface2); }

    /* Context bar */
    .context-bar { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); padding: 8px 10px; display: flex; align-items: center; justify-content: space-between; gap: 6px; min-height: 38px; }
    .context-bar.dirty { border-color: var(--warning); }
    .context-info { display: flex; flex-direction: column; gap: 2px; overflow: hidden; }
    .ctx-file { font-size: 11px; font-weight: 500; color: var(--text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 180px; }
    .ctx-meta { font-size: 10px; color: var(--muted); }
    .ctx-badge { font-size: 10px; padding: 2px 7px; border-radius: 99px; background: var(--surface2); color: var(--muted); border: 1px solid var(--border); white-space: nowrap; flex-shrink: 0; }
    .ctx-badge.dirty-badge { background: #2a1e00; color: var(--warning); border-color: #4a3500; }
    #ctx-empty { font-size: 11px; color: var(--muted); text-align: center; width: 100%; padding: 2px 0; }

    /* Action buttons */
    .actions { display: flex; flex-direction: column; gap: 6px; }
    .btn { display: flex; align-items: center; gap: 8px; background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); padding: 9px 11px; cursor: pointer; color: var(--text); font-size: 11.5px; font-weight: 500; transition: background 120ms, border-color 120ms, transform 80ms; text-align: left; width: 100%; }
    .btn:hover { background: var(--surface2); border-color: #3a3a3a; }
    .btn:active { transform: scale(0.98); }
    .btn .btn-icon { font-size: 14px; flex-shrink: 0; width: 22px; height: 22px; display: flex; align-items: center; justify-content: center; border-radius: 5px; }
    .btn-remember .btn-icon { background: #1a2e1a; color: #4ade80; }
    .btn-recall   .btn-icon { background: #1a2035; color: #60a5fa; }
    .btn-draft    .btn-icon { background: #2a1a30; color: #c084fc; }
    .btn-improve  .btn-icon { background: #1a2e2e; color: #22d3ee; }
    .btn-forget   .btn-icon { background: #2e1a1a; color: #f87171; }
    .btn-text { flex: 1; }
    .btn-label { font-size: 11.5px; font-weight: 500; color: var(--text); }
    .btn-hint  { font-size: 10px; color: var(--muted); margin-top: 1px; }
    .btn-kbd { font-size: 9.5px; color: var(--faint); background: #1e1e1e; border: 1px solid #333; border-radius: 3px; padding: 1px 5px; font-family: monospace; flex-shrink: 0; }

    /* Sections */
    .section { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); overflow: hidden; }
    .section-header { display: flex; align-items: center; justify-content: space-between; padding: 8px 10px; border-bottom: 1px solid var(--border); background: var(--surface2); }
    .section-title { font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.06em; color: var(--muted); }
    .section-count { font-size: 10px; color: var(--muted); background: var(--bg); border: 1px solid var(--border); border-radius: 99px; padding: 1px 7px; }
    .section-body { padding: 8px 10px; }

    /* Bug cards */
    .bug-list { display: flex; flex-direction: column; gap: 7px; }
    .bug-card { background: var(--surface2); border: 1px solid var(--border); border-radius: var(--radius-sm); padding: 9px 10px; position: relative; }
    .bug-card:hover { border-color: #3a3a3a; }
    .bug-score { position: absolute; top: 8px; right: 9px; font-size: 9.5px; color: var(--accent); background: var(--accent-dim); border-radius: 99px; padding: 1px 6px; }
    .bug-title { font-size: 11.5px; font-weight: 500; color: var(--text); margin-bottom: 3px; padding-right: 48px; line-height: 1.4; }
    .bug-meta { font-size: 10px; color: var(--muted); display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 5px; }
    .bug-summary { font-size: 10.5px; color: #aaa; line-height: 1.5; margin-bottom: 6px; }
    .bug-actions { display: flex; gap: 5px; margin-top: 4px; }
    .pill-btn { font-size: 10px; padding: 2px 8px; background: var(--bg); border: 1px solid var(--border); border-radius: 99px; cursor: pointer; color: var(--muted); transition: color 100ms, border-color 100ms; }
    .pill-btn:hover { color: var(--text); border-color: #555; }

    /* Memory graph */
    .graph-nodes { display: flex; flex-direction: column; gap: 0; }
    .graph-node { background: var(--surface2); border: 1px solid var(--border); border-radius: 6px; padding: 8px 10px; cursor: pointer; transition: background 0.15s; }
    .graph-node:hover { background: #222; border-color: var(--accent); }
    .graph-node-header { display: flex; align-items: center; gap: 6px; margin-bottom: 3px; }
    .graph-node-file { font-size: 12px; font-weight: 600; color: var(--text); flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .graph-node-score { font-size: 10px; font-weight: 700; padding: 1px 5px; border-radius: 10px; }
    .score-high { background: #1a4731; color: #4ade80; }
    .score-mid  { background: #3d2e00; color: #facc15; }
    .score-low  { background: #3b1a1a; color: #f87171; }
    .graph-node-title { font-size: 11px; color: var(--muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .graph-edge { text-align: center; color: var(--faint); line-height: 1; margin: 2px 0; font-size: 14px; }

    /* Recently enhanced */
    .enhanced-list { display: flex; flex-direction: column; gap: 5px; }
    .enhanced-item { display: flex; align-items: center; justify-content: space-between; padding: 5px 8px; background: var(--surface2); border: 1px solid var(--border); border-radius: var(--radius-sm); }
    .enhanced-file { font-size: 11px; color: var(--text); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 130px; }
    .enhanced-badge { font-size: 9px; color: #22d3ee; background: #0a1e20; border: 1px solid #1a3a3a; border-radius: 99px; padding: 1px 6px; white-space: nowrap; }
    .enhanced-time { font-size: 9px; color: var(--faint); }

    /* Empty states */
    .empty-state { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 18px 12px; gap: 5px; text-align: center; }
    .empty-icon  { font-size: 22px; margin-bottom: 2px; }
    .empty-label { font-size: 11px; color: var(--muted); }
    .empty-sub   { font-size: 10px; color: var(--faint); }

    /* Toast */
    #status-toast { position: fixed; bottom: 14px; left: 10px; right: 10px; background: var(--surface2); border: 1px solid var(--border); border-radius: var(--radius); padding: 8px 11px; font-size: 11px; color: var(--text); display: flex; align-items: center; gap: 7px; opacity: 0; transform: translateY(6px); transition: opacity 200ms, transform 200ms; pointer-events: none; z-index: 100; }
    #status-toast.show { opacity: 1; transform: translateY(0); }
    #status-toast.success { border-color: #1a3a1a; }
    #status-toast.error   { border-color: #3a1a1a; }
    .toast-dot { width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0; }
    .success .toast-dot { background: var(--success); }
    .error   .toast-dot { background: var(--error); }
    .default .toast-dot { background: var(--accent); }

    /* Footer */
    .footer { margin-top: auto; display: flex; align-items: center; justify-content: space-between; padding-top: 8px; border-top: 1px solid var(--border); }
    .conn-status { display: flex; align-items: center; gap: 5px; font-size: 10px; color: var(--muted); }
    .conn-dot { width: 6px; height: 6px; border-radius: 50%; background: var(--success); }
    .conn-dot.offline { background: var(--faint); }
    .session-stats { font-size: 10px; color: var(--faint); }
  </style>
</head>
<body>
<div class="shell">

  <!-- Header -->
  <div class="header">
    <div class="header-left">
      <div class="logo-icon">🧠</div>
      <div>
        <div class="logo-text">Dev-Context</div>
        <div class="logo-sub">Cognee memory assistant</div>
      </div>
    </div>
    <div class="header-right">
      <span class="score-badge" id="score-badge">🏆 0 pts</span>
      <button class="icon-btn" title="End Session &amp; Distill" onclick="post('endSession')">⏹</button>
      <button class="icon-btn" title="Open Settings" onclick="post('openSettings')">⚙</button>
    </div>
  </div>

  <!-- Active file context bar -->
  <div class="context-bar" id="ctx-bar">
    <div id="ctx-empty">No file open</div>
    <div class="context-info" id="ctx-info" style="display:none">
      <div class="ctx-file" id="ctx-file"></div>
      <div class="ctx-meta" id="ctx-meta"></div>
    </div>
    <div class="ctx-badge" id="ctx-badge" style="display:none"></div>
  </div>

  <!-- Action buttons -->
  <div class="actions">
    <button class="btn btn-remember" onclick="post('runRemember')">
      <div class="btn-icon">💾</div>
      <div class="btn-text">
        <div class="btn-label">Save Context</div>
        <div class="btn-hint">Ingest current file into Cognee</div>
      </div>
      <div class="btn-kbd">⌃⇧M</div>
    </button>
    <button class="btn btn-recall" onclick="post('runRecall')">
      <div class="btn-icon">🔍</div>
      <div class="btn-text">
        <div class="btn-label">Recall Similar Bugs</div>
        <div class="btn-hint">Search Cognee memory for this file</div>
      </div>
      <div class="btn-kbd">⌃⇧R</div>
    </button>
    <button class="btn btn-draft" onclick="post('runDraft')">
      <div class="btn-icon">📝</div>
      <div class="btn-text">
        <div class="btn-label">Draft GitHub Issue</div>
        <div class="btn-hint">Auto-draft from recalled context</div>
      </div>
      <div class="btn-kbd">⌃⇧I</div>
    </button>
    <button class="btn btn-improve" onclick="post('runImprove')">
      <div class="btn-icon">🔄</div>
      <div class="btn-text">
        <div class="btn-label">Improve Context</div>
        <div class="btn-hint">Re-ingest with better context</div>
      </div>
      <div class="btn-kbd">⌃⇧U</div>
    </button>
    <button class="btn btn-forget" onclick="post('runForget')">
      <div class="btn-icon">🗑</div>
      <div class="btn-text">
        <div class="btn-label">Forget Context</div>
        <div class="btn-hint">Delete this file's memory</div>
      </div>
      <div class="btn-kbd">⌃⇧D</div>
    </button>
  </div>

  <!-- Recalled bugs section -->
  <div class="section" id="bugs-section">
    <div class="section-header">
      <span class="section-title">Recalled Bugs</span>
      <span class="section-count" id="bugs-count">0</span>
    </div>
    <div class="section-body">
      <div class="empty-state" id="bugs-empty">
        <div class="empty-icon">🔎</div>
        <div class="empty-label">No bugs recalled yet</div>
        <div class="empty-sub">Run Recall Similar Bugs to search memory</div>
      </div>
      <div class="bug-list" id="bug-list" style="display:none"></div>
    </div>
  </div>

  <!-- Memory connections graph section -->
  <div class="section">
    <div class="section-header">
      <span class="section-title">Memory Connections</span>
      <span class="section-count" id="graph-count">0</span>
    </div>
    <div class="section-body" id="graph-body">
      <div class="empty-state" id="graph-empty">
        <div class="empty-icon">🔗</div>
        <div class="empty-label">No connections yet</div>
        <div class="empty-sub">Run Recall to see memory connections</div>
      </div>
      <div class="graph-nodes" id="graph-nodes" style="display:none"></div>
    </div>
  </div>

  <!-- Last ingested section -->
  <div class="section">
    <div class="section-header">
      <span class="section-title">Last Saved</span>
    </div>
    <div class="section-body">
      <div class="empty-state" id="saved-empty">
        <div class="empty-icon">📁</div>
        <div class="empty-label">Nothing saved yet</div>
        <div class="empty-sub">Save Context to record a file</div>
      </div>
      <div id="saved-info" style="display:none">
        <div class="bug-card">
          <div class="bug-title" id="saved-file"></div>
          <div class="bug-meta">
            <span id="saved-lang"></span>
            <span id="saved-symbols"></span>
            <span id="saved-lines"></span>
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- Recently Enhanced section -->
  <div class="section">
    <div class="section-header">
      <span class="section-title">Recently Enhanced</span>
      <span class="section-count" id="enhanced-count">0</span>
    </div>
    <div class="section-body">
      <div class="empty-state" id="enhanced-empty">
        <div class="empty-icon">✨</div>
        <div class="empty-label">No improvements yet</div>
        <div class="empty-sub">Improve a context to see it here</div>
      </div>
      <div class="enhanced-list" id="enhanced-list" style="display:none"></div>
    </div>
  </div>

  <!-- Footer -->
  <div class="footer">
    <div class="conn-status">
      <div class="conn-dot" id="conn-dot"></div>
      <span id="conn-label">Ready</span>
    </div>
    <div class="session-stats" id="session-stats">💾 0 saved · 🔍 0 recalled</div>
  </div>

</div>

<!-- Toast -->
<div id="status-toast">
  <div class="toast-dot"></div>
  <span id="toast-text"></span>
</div>

<script>
  const vscode = acquireVsCodeApi();
  let toastTimer = null;
  let enhancedItems = [];

  function post(type, payload) {
    vscode.postMessage({ type, payload });
  }

  function showToast(text, kind) {
    kind = kind || 'default';
    const toast = document.getElementById('status-toast');
    const label = document.getElementById('toast-text');
    toast.className = '';
    toast.classList.add('show', kind);
    label.textContent = text;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function() { toast.classList.remove('show'); }, 3200);
  }

  function setConn(ok) {
    document.getElementById('conn-dot').className = 'conn-dot' + (ok ? '' : ' offline');
    document.getElementById('conn-label').textContent = ok ? 'Ready' : 'Offline';
  }

  function updateScore(pts) {
    document.getElementById('score-badge').textContent = '\uD83C\uDFC6 ' + pts + ' pts';
  }

  function updateStats(filesSaved, bugsRecalled) {
    document.getElementById('session-stats').textContent =
      '\uD83D\uDCBE ' + (filesSaved || 0) + ' saved \u00B7 \uD83D\uDD0D ' + (bugsRecalled || 0) + ' recalled';
  }

  function relativeTime(isoStr) {
    const diff = Math.floor((Date.now() - new Date(isoStr).getTime()) / 1000);
    if (diff < 60) return diff + 's ago';
    if (diff < 3600) return Math.floor(diff / 60) + 'm ago';
    return Math.floor(diff / 3600) + 'h ago';
  }

  function addEnhanced(filename, timestamp) {
    enhancedItems.unshift({ filename: filename, timestamp: timestamp || new Date().toISOString() });
    if (enhancedItems.length > 3) { enhancedItems.pop(); }
    renderEnhanced();
  }

  function renderEnhanced() {
    const list  = document.getElementById('enhanced-list');
    const empty = document.getElementById('enhanced-empty');
    const count = document.getElementById('enhanced-count');
    count.textContent = enhancedItems.length;
    if (!enhancedItems.length) {
      list.style.display  = 'none';
      empty.style.display = '';
      return;
    }
    list.style.display  = '';
    empty.style.display = 'none';
    list.innerHTML = enhancedItems.map(function(item) {
      return '<div class="enhanced-item">'
        + '<span class="enhanced-file">' + esc(shortFile(item.filename)) + '</span>'
        + '<span class="enhanced-badge">\u2713 memified</span>'
        + '<span class="enhanced-time">' + relativeTime(item.timestamp) + '</span>'
        + '</div>';
    }).join('');
  }

  function renderGraph(bugs) {
    const nodes = document.getElementById('graph-nodes');
    const empty = document.getElementById('graph-empty');
    const count = document.getElementById('graph-count');
    count.textContent = bugs.length;
    if (!bugs.length) {
      nodes.style.display = 'none';
      empty.style.display = '';
      return;
    }
    nodes.style.display = '';
    empty.style.display = 'none';
    nodes.innerHTML = bugs.map(function(bug, i) {
      var sim   = bug.score !== undefined ? bug.score : (bug.similarity || 0);
      var pct   = Math.round(sim * 100);
      var cls   = pct >= 75 ? 'score-high' : pct >= 50 ? 'score-mid' : 'score-low';
      var file  = bug.file || bug.fileName || '';
      var title = bug.title || bug.name || bug.summary || ('Bug #' + (i + 1));
      var edge  = i < bugs.length - 1 ? '<div class="graph-edge">\u2502</div>' : '';
      return '<div class="graph-node" onclick="post(\'openFile\', \'' + esc(file) + '\')" title="' + esc(title) + '">'
        + '<div class="graph-node-header">'
        + '<span>\uD83D\uDCC4</span>'
        + '<span class="graph-node-file">' + esc(shortFile(file)) + '</span>'
        + '<span class="graph-node-score ' + cls + '">' + pct + '%</span>'
        + '</div>'
        + '<div class="graph-node-title">' + esc(title) + '</div>'
        + '</div>'
        + edge;
    }).join('');
  }

  function updateContext(ctx) {
    var empty = document.getElementById('ctx-empty');
    var info  = document.getElementById('ctx-info');
    var badge = document.getElementById('ctx-badge');
    var bar   = document.getElementById('ctx-bar');
    if (!ctx) {
      empty.style.display = ''; info.style.display = 'none'; badge.style.display = 'none';
      bar.className = 'context-bar'; return;
    }
    empty.style.display = 'none'; info.style.display = ''; badge.style.display = '';
    document.getElementById('ctx-file').textContent = ctx.fileName || 'Unknown file';
    document.getElementById('ctx-meta').textContent = ctx.languageId + ' \u00B7 ' + (ctx.lineCount || 0) + ' lines';
    if (ctx.isDirty) {
      badge.textContent = 'unsaved'; badge.className = 'ctx-badge dirty-badge'; bar.className = 'context-bar dirty';
    } else {
      badge.textContent = ctx.languageId; badge.className = 'ctx-badge'; bar.className = 'context-bar';
    }
  }

  function renderBugs(bugs) {
    var list  = document.getElementById('bug-list');
    var empty = document.getElementById('bugs-empty');
    var count = document.getElementById('bugs-count');
    count.textContent = bugs.length;
    if (!bugs.length) { list.style.display = 'none'; empty.style.display = ''; return; }
    list.style.display = ''; empty.style.display = 'none';
    list.innerHTML = '';
    bugs.forEach(function(bug, i) {
      var b       = (typeof bug === 'object' && bug !== null) ? bug : {};
      var title   = b.title   || b.name    || b.summary || ('Bug #' + (i + 1));
      var file    = b.file    || b.fileName || '';
      var lang    = b.language || b.languageId || '';
      var summary = b.summary || b.description || b.body || '';
      var score   = b.score   !== undefined ? (Math.round(b.score * 100) + '%') : '';
      var snippet = b.snippet || b.code || b.codeSnippet || '';
      var qa_id   = b.qa_id   || b.id || '';
      var card    = document.createElement('div');
      card.className = 'bug-card';
      if (qa_id) { card.setAttribute('data-qa-id', qa_id); }
      card.innerHTML = [
        score   ? '<div class="bug-score">' + esc(score) + '</div>' : '',
        '<div class="bug-title">' + esc(title) + '</div>',
        '<div class="bug-meta">',
          file ? '<span>' + esc(file) + '</span>' : '',
          lang ? '<span>' + esc(lang) + '</span>' : '',
        '</div>',
        summary ? '<div class="bug-summary">' + esc(summary.slice(0, 180)) + (summary.length > 180 ? '\u2026' : '') + '</div>' : '',
        '<div class="bug-actions">',
          snippet ? '<button class="pill-btn" onclick="post(\'copyToClipboard\', \'' + esc(snippet.replace(/'/g, '\\x27')) + '\')" >Copy snippet</button>' : '',
          '<button class="pill-btn" onclick="post(\'runDraft\')">Draft issue</button>',
        '</div>',
        qa_id ? '<div class="feedback-row" style="margin-top:6px;display:flex;gap:8px;"><button class="pill-btn feedback-btn up" data-score="1">[\uD83D\uDC4D Helpful]</button><button class="pill-btn feedback-btn down" data-score="-1">[\uD83D\uDC4E Unhelpful]</button></div>' : ''
      ].join('');
      list.appendChild(card);
    });
  }

  function renderSaved(payload) {
    if (!payload) { return; }
    document.getElementById('saved-empty').style.display = 'none';
    document.getElementById('saved-info').style.display  = '';
    document.getElementById('saved-file').textContent    = payload.fileName    || '';
    document.getElementById('saved-lang').textContent    = payload.languageId   || '';
    document.getElementById('saved-symbols').textContent = payload.symbolsCount != null ? payload.symbolsCount + ' symbols' : '';
    document.getElementById('saved-lines').textContent   = payload.lineCount    != null ? payload.lineCount    + ' lines'   : '';
  }

  function shortFile(p) { return p ? (p.split('/').pop() || p) : ''; }

  function esc(str) {
    return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  // Feedback delegation
  document.addEventListener('click', function(e) {
    if (e.target.matches('.feedback-btn')) {
      var btn  = e.target;
      var card = btn.closest('.bug-card');
      if (card) {
        vscode.postMessage({ command: 'submitFeedback', qaId: card.getAttribute('data-qa-id'), score: parseInt(btn.getAttribute('data-score'), 10) });
      }
    }
  });

  // Message handler
  window.addEventListener('message', function(event) {
    var msg = event.data;
    if (!msg || (!msg.type && !msg.command)) { return; }
    var action = msg.type || msg.command;
    switch (action) {
      case 'contextUpdate':
        updateContext(msg.context);
        break;
      case 'scoreUpdate':
        updateScore(msg.score || 0);
        break;
      case 'statsUpdate':
        updateStats(msg.filesSaved, msg.bugsRecalled);
        break;
      case 'enhancedUpdate':
        addEnhanced(msg.payload && msg.payload.filename, msg.payload && msg.payload.timestamp);
        break;
      case 'feedbackSuccess':
        var qaId = msg.payload && msg.payload.qaId;
        if (qaId) {
          var cardEl = document.querySelector('.bug-card[data-qa-id="' + qaId + '"]');
          if (cardEl) { var row = cardEl.querySelector('.feedback-row'); if (row) { row.innerHTML = '<span style="font-size:10px;color:var(--success);">\u2713 Feedback submitted</span>'; } }
        }
        break;
      case 'rememberSuccess':
        renderSaved(msg.payload);
        showToast('Context saved to Cognee \u2713', 'success');
        setConn(true);
        break;
      case 'bugsUpdate': {
        var bugs = (msg.payload && msg.payload.bugs) || msg.bugs || [];
        bugs = Array.isArray(bugs) ? bugs : [];
        renderBugs(bugs);
        renderGraph(bugs);
        var lang = (msg.payload && msg.payload.language) || '';
        showToast(
          bugs.length ? bugs.length + ' bug(s) recalled' + (lang ? ' for ' + lang : '') : 'No similar bugs found',
          bugs.length ? 'success' : 'default'
        );
        setConn(true);
        break;
      }
      case 'issueDrafted':
        showToast('Issue draft opened \u2013 ' + ((msg.payload && msg.payload.title) || 'check editor'), 'success');
        break;
      case 'improveSuccess':
        showToast('Context improved \u2713 +15 pts', 'success');
        break;
      case 'forgetSuccess':
        showToast('Context deleted \u2713 +5 pts', 'success');
        document.getElementById('saved-empty').style.display = '';
        document.getElementById('saved-info').style.display  = 'none';
        break;
      case 'error':
        showToast(msg.message || 'Something went wrong', 'error');
        setConn(false);
        break;
    }
  });
</script>
</body>
</html>`;
    }

    dispose(): void {
        this._disposables.forEach(d => d.dispose());
        this._disposables = [];
    }
}
