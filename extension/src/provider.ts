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

        // Handle messages from webview
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
                            title: "Dev-Context: Distilling session memories...",
                            cancellable: false
                        }, async (progress) => {
                            try {
                                const curSession = this._context.globalState.get<string>('currentSessionId') || '';
                                await api.endSession({ sessionId: curSession, triggerDistillation: true });
                                
                                // Restart new session
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
      --bg: #0d0d0d;
      --surface: #141414;
      --surface2: #1c1c1c;
      --border: #2a2a2a;
      --text: #e2e2e2;
      --muted: #888;
      --faint: #444;
      --accent: #4f98a3;
      --accent-dim: #2a4a50;
      --success: #22c55e;
      --warning: #f59e0b;
      --error: #ef4444;
      --radius: 8px;
      --radius-sm: 5px;
    }

    html, body {
      background: var(--bg);
      color: var(--text);
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'SF Pro Text', sans-serif;
      font-size: 12px;
      line-height: 1.5;
      height: 100%;
      overflow-x: hidden;
    }

    .shell {
      display: flex;
      flex-direction: column;
      min-height: 100vh;
      padding: 12px 10px 20px;
      gap: 10px;
    }

    /* ── Header ── */
    .header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding-bottom: 8px;
      border-bottom: 1px solid var(--border);
    }
    .header-left { display: flex; align-items: center; gap: 7px; }
    .logo-icon {
      width: 22px; height: 22px;
      background: var(--accent-dim);
      border: 1px solid var(--accent);
      border-radius: 6px;
      display: flex; align-items: center; justify-content: center;
      font-size: 13px;
    }
    .logo-text { font-size: 13px; font-weight: 600; color: var(--text); }
    .logo-sub  { font-size: 10px; color: var(--muted); margin-top: 1px; }
    .icon-btn {
      background: none; border: none; cursor: pointer;
      color: var(--muted); font-size: 14px; padding: 3px 5px;
      border-radius: var(--radius-sm);
      transition: color 120ms, background 120ms;
    }
    .icon-btn:hover { color: var(--text); background: var(--surface2); }

    /* ── Context chip ── */
    .context-bar {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      padding: 8px 10px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 6px;
      min-height: 38px;
    }
    .context-bar.dirty { border-color: var(--warning); }
    .context-info { display: flex; flex-direction: column; gap: 2px; overflow: hidden; }
    .ctx-file {
      font-size: 11px; font-weight: 500; color: var(--text);
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
      max-width: 180px;
    }
    .ctx-meta { font-size: 10px; color: var(--muted); }
    .ctx-badge {
      font-size: 10px;
      padding: 2px 7px;
      border-radius: 99px;
      background: var(--surface2);
      color: var(--muted);
      border: 1px solid var(--border);
      white-space: nowrap;
      flex-shrink: 0;
    }
    .ctx-badge.dirty-badge { background: #2a1e00; color: var(--warning); border-color: #4a3500; }
    #ctx-empty {
      font-size: 11px; color: var(--muted);
      text-align: center; width: 100%; padding: 2px 0;
    }

    /* ── Action buttons ── */
    .actions { display: flex; flex-direction: column; gap: 6px; }
    .btn {
      display: flex; align-items: center; gap: 8px;
      background: var(--surface); border: 1px solid var(--border);
      border-radius: var(--radius); padding: 9px 11px;
      cursor: pointer; color: var(--text);
      font-size: 11.5px; font-weight: 500;
      transition: background 120ms, border-color 120ms, transform 80ms;
      text-align: left; width: 100%;
    }
    .btn:hover { background: var(--surface2); border-color: #3a3a3a; }
    .btn:active { transform: scale(0.98); }
    .btn .btn-icon {
      font-size: 14px; flex-shrink: 0;
      width: 22px; height: 22px;
      display: flex; align-items: center; justify-content: center;
      border-radius: 5px;
    }
    .btn-remember .btn-icon { background: #1a2e1a; color: #4ade80; }
    .btn-recall   .btn-icon { background: #1a2035; color: #60a5fa; }
    .btn-draft    .btn-icon { background: #2a1a30; color: #c084fc; }
    .btn-text { flex: 1; }
    .btn-label { font-size: 11.5px; font-weight: 500; color: var(--text); }
    .btn-hint  { font-size: 10px; color: var(--muted); margin-top: 1px; }
    .btn-kbd {
      font-size: 9.5px; color: var(--faint);
      background: #1e1e1e; border: 1px solid #333;
      border-radius: 3px; padding: 1px 5px;
      font-family: monospace; flex-shrink: 0;
    }

    /* ── Section ── */
    .section {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      overflow: hidden;
    }
    .section-header {
      display: flex; align-items: center; justify-content: space-between;
      padding: 8px 10px;
      border-bottom: 1px solid var(--border);
      background: var(--surface2);
    }
    .section-title {
      font-size: 10px; font-weight: 600; text-transform: uppercase;
      letter-spacing: 0.06em; color: var(--muted);
    }
    .section-count {
      font-size: 10px; color: var(--muted);
      background: var(--bg);
      border: 1px solid var(--border);
      border-radius: 99px;
      padding: 1px 7px;
    }
    .section-body { padding: 8px 10px; }

    /* ── Bug cards ── */
    .bug-list { display: flex; flex-direction: column; gap: 7px; }
    .bug-card {
      background: var(--surface2);
      border: 1px solid var(--border);
      border-radius: var(--radius-sm);
      padding: 9px 10px;
      position: relative;
    }
    .bug-card:hover { border-color: #3a3a3a; }
    .bug-score {
      position: absolute; top: 8px; right: 9px;
      font-size: 9.5px; color: var(--accent);
      background: var(--accent-dim);
      border-radius: 99px; padding: 1px 6px;
    }
    .bug-title {
      font-size: 11.5px; font-weight: 500; color: var(--text);
      margin-bottom: 3px; padding-right: 48px;
      line-height: 1.4;
    }
    .bug-meta {
      font-size: 10px; color: var(--muted);
      display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 5px;
    }
    .bug-summary {
      font-size: 10.5px; color: #aaa; line-height: 1.5;
      margin-bottom: 6px;
    }
    .bug-actions { display: flex; gap: 5px; margin-top: 4px; }
    .pill-btn {
      font-size: 10px; padding: 2px 8px;
      background: var(--bg); border: 1px solid var(--border);
      border-radius: 99px; cursor: pointer; color: var(--muted);
      transition: color 100ms, border-color 100ms;
    }
    .pill-btn:hover { color: var(--text); border-color: #555; }

    /* ── Empty / idle states ── */
    .empty-state {
      display: flex; flex-direction: column;
      align-items: center; justify-content: center;
      padding: 18px 12px; gap: 5px;
      text-align: center;
    }
    .empty-icon { font-size: 22px; margin-bottom: 2px; }
    .empty-label { font-size: 11px; color: var(--muted); }
    .empty-sub   { font-size: 10px; color: var(--faint); }

    /* ── Status toast ── */
    #status-toast {
      position: fixed; bottom: 14px; left: 10px; right: 10px;
      background: var(--surface2);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      padding: 8px 11px;
      font-size: 11px; color: var(--text);
      display: flex; align-items: center; gap: 7px;
      opacity: 0; transform: translateY(6px);
      transition: opacity 200ms, transform 200ms;
      pointer-events: none;
      z-index: 100;
    }
    #status-toast.show { opacity: 1; transform: translateY(0); }
    #status-toast.success { border-color: #1a3a1a; }
    #status-toast.error   { border-color: #3a1a1a; }
    .toast-dot {
      width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0;
    }
    .success .toast-dot { background: var(--success); }
    .error   .toast-dot { background: var(--error); }
    .default .toast-dot { background: var(--accent); }

    /* ── Footer ── */
    .footer {
      margin-top: auto;
      display: flex; align-items: center; justify-content: space-between;
      padding-top: 8px;
      border-top: 1px solid var(--border);
    }
    .conn-status { display: flex; align-items: center; gap: 5px; font-size: 10px; color: var(--muted); }
    .conn-dot { width: 6px; height: 6px; border-radius: 50%; background: var(--success); }
    .conn-dot.offline { background: var(--faint); }
    .ver { font-size: 10px; color: var(--faint); }
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
    <div>
      <button class="icon-btn" title="End Session & Distill" onclick="post('endSession')">⏹</button>
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

  <!-- Footer -->
  <div class="footer">
    <div class="conn-status">
      <div class="conn-dot" id="conn-dot"></div>
      <span id="conn-label">Ready</span>
    </div>
    <div class="ver">v0.1.0</div>
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

  function post(type, payload) {
    vscode.postMessage({ type, payload });
  }

  function showToast(text, kind = 'default') {
    const toast = document.getElementById('status-toast');
    const label = document.getElementById('toast-text');
    toast.className = '';
    toast.classList.add('show', kind);
    label.textContent = text;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('show'), 3200);
  }

  function setConn(ok) {
    document.getElementById('conn-dot').className = 'conn-dot' + (ok ? '' : ' offline');
    document.getElementById('conn-label').textContent = ok ? 'Ready' : 'Offline';
  }

  function updateContext(ctx) {
    const empty = document.getElementById('ctx-empty');
    const info  = document.getElementById('ctx-info');
    const badge = document.getElementById('ctx-badge');
    const bar   = document.getElementById('ctx-bar');

    if (!ctx) {
      empty.style.display = '';
      info.style.display  = 'none';
      badge.style.display = 'none';
      bar.className = 'context-bar';
      return;
    }

    empty.style.display = 'none';
    info.style.display  = '';
    badge.style.display = '';

    document.getElementById('ctx-file').textContent = ctx.fileName || 'Unknown file';
    document.getElementById('ctx-meta').textContent =
      ctx.languageId + ' \u00b7 ' + (ctx.lineCount || 0) + ' lines';

    if (ctx.isDirty) {
      badge.textContent = 'unsaved';
      badge.className = 'ctx-badge dirty-badge';
      bar.className = 'context-bar dirty';
    } else {
      badge.textContent = ctx.languageId;
      badge.className = 'ctx-badge';
      bar.className = 'context-bar';
    }
  }

  function renderBugs(bugs) {
    const list  = document.getElementById('bug-list');
    const empty = document.getElementById('bugs-empty');
    const count = document.getElementById('bugs-count');

    count.textContent = bugs.length;

    if (!bugs.length) {
      list.style.display  = 'none';
      empty.style.display = '';
      return;
    }

    list.style.display  = '';
    empty.style.display = 'none';
    list.innerHTML = '';

      bugs.forEach((bug, i) => {
        const b = typeof bug === 'object' && bug !== null ? bug : {};
        const title   = b.title   || b.name    || b.summary || ('Bug #' + (i + 1));
        const file    = b.file    || b.fileName || '';
        const lang    = b.language || b.languageId || '';
        const summary = b.summary || b.description || b.body || '';
        const score   = b.score   !== undefined ? (Math.round(b.score * 100) + '%') : '';
        const snippet = b.snippet || b.code || b.codeSnippet || '';
        const qa_id   = b.qa_id   || b.id || '';

        const card = document.createElement('div');
        card.className = 'bug-card';
        if (qa_id) {
          card.setAttribute('data-qa-id', qa_id);
        }
        card.innerHTML = [
          score ? '<div class="bug-score">' + score + '</div>' : '',
          '<div class="bug-title">' + esc(title) + '</div>',
          '<div class="bug-meta">',
            file ? '<span>' + esc(file) + '</span>' : '',
            lang ? '<span>' + esc(lang) + '</span>' : '',
          '</div>',
          summary ? '<div class="bug-summary">' + esc(summary.slice(0, 180)) + (summary.length > 180 ? '\u2026' : '') + '</div>' : '',
          '<div class="bug-actions">',
            snippet ? '<button class="pill-btn" onclick="post(\'copyToClipboard\', \'' + esc(snippet.replace(/'/g,'\\x27')) + '\')" >Copy snippet</button>' : '',
            '<button class="pill-btn" onclick="post(\'runDraft\')">Draft issue</button>',
          '</div>',
          qa_id ? [
            '<div class="feedback-row" style="margin-top: 6px; display: flex; gap: 8px;">',
              '<button class="pill-btn feedback-btn up" data-score="1">[👍 Helpful]</button>',
              '<button class="pill-btn feedback-btn down" data-score="-1">[👎 Unhelpful]</button>',
            '</div>'
          ].join('') : ''
        ].join('');

      list.appendChild(card);
    });
  }

  function renderSaved(payload) {
    const empty = document.getElementById('saved-empty');
    const info  = document.getElementById('saved-info');
    if (!payload) { return; }
    empty.style.display = 'none';
    info.style.display  = '';
    document.getElementById('saved-file').textContent    = payload.fileName    || '';
    document.getElementById('saved-lang').textContent    = payload.languageId   || '';
    document.getElementById('saved-symbols').textContent = payload.symbolsCount != null ? payload.symbolsCount + ' symbols' : '';
    document.getElementById('saved-lines').textContent   = payload.lineCount    != null ? payload.lineCount    + ' lines'   : '';
  }

  function esc(str) {
    return String(str)
      .replace(/&/g,'&amp;')
      .replace(/</g,'&lt;')
      .replace(/>/g,'&gt;')
      .replace(/"/g,'&quot;');
  }

  // ── Event Delegation for Feedback ──
  document.addEventListener('click', (e) => {
    if (e.target.matches('.feedback-btn')) {
      const btn = e.target;
      const card = btn.closest('.bug-card');
      if (card) {
        const targetQaId = card.getAttribute('data-qa-id');
        const selectedScore = parseInt(btn.getAttribute('data-score'), 10);
        
        vscode.postMessage({
          command: 'submitFeedback',
          qaId: targetQaId,
          score: selectedScore
        });
      }
    }
  });

  // ── Message handler ──
  window.addEventListener('message', (event) => {
    const msg = event.data;
    if (!msg || (!msg.type && !msg.command)) { return; }

    const action = msg.type || msg.command;
    switch (action) {
      case 'contextUpdate':
        updateContext(msg.context);
        break;

      case 'feedbackSuccess':
        const qaId = msg.payload?.qaId;
        if (qaId) {
          const card = document.querySelector(\`.bug-card[data-qa-id="\${qaId}"]\`);
          if (card) {
            const row = card.querySelector('.feedback-row');
            if (row) {
              row.innerHTML = '<span style="font-size: 10px; color: var(--success);">✓ Feedback submitted</span>';
            }
          }
        }
        break;

      case 'rememberSuccess':
        renderSaved(msg.payload);
        showToast('Context saved to Cognee \u2713', 'success');
        setConn(true);
        break;

      case 'bugsUpdate': {
        const bugs = msg.payload?.bugs ?? msg.bugs ?? [];
        renderBugs(Array.isArray(bugs) ? bugs : []);
        const lang = msg.payload?.language || '';
        showToast(
          bugs.length
            ? bugs.length + ' bug(s) recalled' + (lang ? ' for ' + lang : '')
            : 'No similar bugs found',
          bugs.length ? 'success' : 'default'
        );
        setConn(true);
        break;
      }

      case 'issueDrafted':
        showToast('Issue draft opened \u2013 ' + (msg.payload?.title || 'check editor'), 'success');
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
