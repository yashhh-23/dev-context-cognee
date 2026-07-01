import * as vscode from 'vscode';
import { DevContextWebViewProvider } from './provider';
import { registerRememberContextCommand, ProviderBridge, StatusSetter } from './commands/rememberContext';
import { registerRecallBugsCommand } from './commands/recallBugs';
import { registerDraftIssueCommand } from './commands/draftIssue';
import { registerRememberChangedFilesCommand } from './commands/rememberChangedFiles';
import { ApiClient } from './utils/apiClient';
import { isSupportedLanguage } from './utils/languageDetector';
import { bugDecorationType } from './decorations/bugDecorator';
import { improveContext } from './commands/improveContext';
import { forgetContext } from './commands/forgetContext';
import { StateManager } from './utils/stateManager';
import { ScoreManager } from './utils/scoreManager';
import { SessionTracker } from './utils/sessionTracker';
import { runOnboarding } from './commands/onboarding';

// ─── Status Bar ────────────────────────────────────────────────────────────────
let statusBarItem: vscode.StatusBarItem;

function createStatusBar(): vscode.StatusBarItem {
    const item = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    item.text = '$(brain) Cognee';
    item.tooltip = 'Dev-Context Assistant — click to open sidebar';
    item.command = 'devContextSidebar.focus';
    item.show();
    return item;
}
function setStatusBarSyncing(): void { if (statusBarItem) { statusBarItem.text = '$(sync~spin) Cognee'; } }
function setStatusBarDone(message = 'Cognee'): void {
    if (!statusBarItem) { return; }
    statusBarItem.text = `$(brain) ${message}`;
    setTimeout(() => { if (statusBarItem) { statusBarItem.text = '$(brain) Cognee'; } }, 3000);
}
function setStatusBarError(): void {
    if (!statusBarItem) { return; }
    statusBarItem.text = '$(error) Cognee';
    setTimeout(() => { if (statusBarItem) { statusBarItem.text = '$(brain) Cognee'; } }, 4000);
}
function setStatusBarLowMatch(): void {
    if (!statusBarItem) { return; }
    statusBarItem.text = '$(warning) Low match — Memify?';
    setTimeout(() => { if (statusBarItem) { statusBarItem.text = '$(brain) Cognee'; } }, 5000);
}
function setStatusBarMilestone(pts: number): void {
    if (!statusBarItem) { return; }
    statusBarItem.text = `$(star) ${pts} pts!`;
    setTimeout(() => { if (statusBarItem) { statusBarItem.text = '$(brain) Cognee'; } }, 3000);
}
function setStatusBarOffline(): void {
    if (!statusBarItem) { return; }
    statusBarItem.text = '$(error) Cognee offline';
}

export const statusBar = {
    syncing:   setStatusBarSyncing,
    done:      setStatusBarDone,
    error:     setStatusBarError,
    lowMatch:  setStatusBarLowMatch,
    milestone: setStatusBarMilestone,
    offline:   setStatusBarOffline
};

// ─── Activate ─────────────────────────────────────────────────────────────────
export function activate(context: vscode.ExtensionContext): void {
    console.log('Dev-Context Assistant: activating...');

    // 1. Status bar
    statusBarItem = createStatusBar();
    context.subscriptions.push(statusBarItem);

    // 2. Sidebar provider
    const provider = new DevContextWebViewProvider(context.extensionUri, context);
    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider(
            DevContextWebViewProvider.viewType,
            provider,
            { webviewOptions: { retainContextWhenHidden: true } }
        )
    );

    // 3. Bridges
    const status: StatusSetter = { syncing: setStatusBarSyncing, done: setStatusBarDone, error: setStatusBarError };
    const bridge: ProviderBridge = {
        updateContextSummary: (doc) => provider.updateContextSummary(doc),
        postMessageToWebview: (msg) => provider.postMessageToWebview(msg)
    };

    // 4. Managers — ScoreManager receives milestone callback, NO circular import
    const api            = new ApiClient({ context });
    const stateManager   = new StateManager(context);
    const scoreManager   = new ScoreManager(stateManager, setStatusBarMilestone);
    const sessionTracker = new SessionTracker(stateManager);

    // 5. Onboarding
    runOnboarding(context, api);

    // 6. Startup health check
    const backendUrl = vscode.workspace.getConfiguration('devContext').get<string>('backendUrl', 'http://localhost:8000');
    const statsUrl   = backendUrl.endsWith('/') ? `${backendUrl}api/stats` : `${backendUrl}/api/stats`;
    fetch(statsUrl)
        .then(res => {
            if (res.ok) {
                provider.postMessageToWebview({ type: 'setConn', connected: true });
            } else {
                setStatusBarOffline();
                provider.postMessageToWebview({ type: 'error', message: 'Backend offline' });
            }
        })
        .catch(() => {
            setStatusBarOffline();
            provider.postMessageToWebview({ type: 'error', message: 'Backend offline' });
        });

    // Helper: push score + stats to sidebar
    function syncSidebarMetrics(): void {
        provider.postMessageToWebview({ type: 'scoreUpdate', score: scoreManager.getScore() });
        const stats = sessionTracker.getStats();
        provider.postMessageToWebview({ type: 'statsUpdate', filesSaved: stats.filesSaved, bugsRecalled: stats.bugsRecalled });
    }

    // ─── Session Lifecycle ──────────────────────────────────────────────────────
    const sessionId = `session_${Date.now()}_${vscode.env.machineId.slice(0, 8)}`;
    context.globalState.update('currentSessionId', sessionId);
    api.startSession({ sessionId, workspaceName: vscode.workspace.name || 'unnamed-workspace' })
        .then(() => console.log(`Dev-Context: Started session ${sessionId}`))
        .catch(err => console.warn(`Dev-Context: Backend offline, session not started (${err instanceof Error ? err.message : String(err)})`));

    context.subscriptions.push(
        new vscode.Disposable(() => {
            const curSession = context.globalState.get<string>('currentSessionId') || sessionId;
            api.endSession({ sessionId: curSession, triggerDistillation: true })
                .then(() => console.log(`Dev-Context: Ended session ${curSession}`))
                .catch(err => console.warn(`Dev-Context: Backend offline, session not ended (${err instanceof Error ? err.message : String(err)})`));
        })
    );

    // ─── Sidebar refresh command ─────────────────────────────────────────────────────
    context.subscriptions.push(
        vscode.commands.registerCommand('devContext.refreshSidebar', (payload: any) => {
            if (!payload) { return; }
            if (payload.type === 'improved') {
                provider.postMessageToWebview({ type: 'enhancedUpdate', payload: { filename: payload.filename, timestamp: new Date().toISOString() } });
                provider.postMessageToWebview({ type: 'improveSuccess' });
                sessionTracker.increment('improved');
            } else if (payload.type === 'forgotten') {
                provider.postMessageToWebview({ type: 'forgetSuccess' });
                sessionTracker.increment('deleted');
            }
            syncSidebarMetrics();
        })
    );

    // ─── Commands ───────────────────────────────────────────────────────────────
    context.subscriptions.push(
        registerRememberContextCommand(context, bridge, status),
        registerRecallBugsCommand(context, bridge, status),
        registerDraftIssueCommand(context, bridge, status),
        registerRememberChangedFilesCommand(context, bridge, status),
        vscode.commands.registerCommand('devContext.improveContext', async () => {
            await improveContext(context, api, scoreManager);
            syncSidebarMetrics();
        }),
        vscode.commands.registerCommand('devContext.forgetContext', async () => {
            await forgetContext(context, api, scoreManager);
            syncSidebarMetrics();
        }),
        vscode.commands.registerCommand('devContext.resetOnboarding', () => {
            context.globalState.update('devContext.onboardingDone', false);
            runOnboarding(context, api);
        }),
        vscode.commands.registerCommand('devContext.resetDemo', async () => {
            // Use manager methods — they know the correct internal state keys
            scoreManager.resetScore();
            sessionTracker.reset();
            await context.globalState.update('devContext.onboardingDone', false);
            syncSidebarMetrics();
            vscode.window.showInformationMessage('Dev-Context: Demo reset ✓ — all memory cleared');
            runOnboarding(context, api);
        }),
        bugDecorationType
    );

    // Push initial score + stats after sidebar loads
    setTimeout(() => {
        syncSidebarMetrics();
        const doc = vscode.window.activeTextEditor?.document || vscode.window.visibleTextEditors[0]?.document;
        if (doc) { provider.updateContextSummary(doc); }
    }, 1500);

    // 6. File watcher
    context.subscriptions.push(
        vscode.workspace.onDidChangeTextDocument(async (event) => {
            const watcherEnabled = vscode.workspace.getConfiguration('devContext').get<boolean>('watcherEnabled', true);
            if (!watcherEnabled || event.document.uri.scheme !== 'file') { return; }
            if (provider.isOpen) { await provider.updateContextSummary(event.document); }
        })
    );

    // 7. Tab switch
    context.subscriptions.push(
        vscode.window.onDidChangeActiveTextEditor(async (editor) => {
            const doc = editor?.document || vscode.window.visibleTextEditors[0]?.document;
            if (doc && provider.isOpen) { await provider.updateContextSummary(doc); }
        })
    );

    // 8. Auto-save on file save
    context.subscriptions.push(
        vscode.workspace.onDidSaveTextDocument(async (document) => {
            const config = vscode.workspace.getConfiguration('devContext');
            if (!config.get<boolean>('autoSaveOnFileSave', true)) { return; }
            if (!isSupportedLanguage(document.languageId)) { return; }
            try {
                await api.ingestContext({
                    content: document.getText(),
                    fileName: vscode.workspace.asRelativePath(document.fileName),
                    languageId: document.languageId,
                    source: 'auto-save'
                });
                scoreManager.addForAction('save');
                sessionTracker.increment('saved');
                syncSidebarMetrics();
                setStatusBarDone('Saved ✓');
            } catch (err) {
                console.warn(`Dev-Context: Auto-save skipped, backend offline (${err instanceof Error ? err.message : String(err)})`);
            }
        })
    );

    // 9. Diagnostics
    let diagnosticDebounceTimer: NodeJS.Timeout | undefined;
    context.subscriptions.push(
        vscode.languages.onDidChangeDiagnostics(async (event) => {
            const config = vscode.workspace.getConfiguration('devContext');
            if (!config.get<boolean>('feedDiagnosticsToCognee', true)) { return; }
            if (diagnosticDebounceTimer) { clearTimeout(diagnosticDebounceTimer); }
            diagnosticDebounceTimer = setTimeout(async () => {
                for (const uri of event.uris) {
                    if (uri.scheme !== 'file') { continue; }
                    const diagnostics = vscode.languages.getDiagnostics(uri);
                    const errors = diagnostics.filter(d => d.severity === vscode.DiagnosticSeverity.Error);
                    if (errors.length === 0) { continue; }
                    const editor = vscode.window.visibleTextEditors.find(e => e.document.uri.toString() === uri.toString());
                    try {
                        await api.ingestContext({
                            content: errors.map(e => `[${e.source || 'Diagnostic'}] Line ${e.range.start.line + 1}: ${e.message}`).join('\n'),
                            fileName: vscode.workspace.asRelativePath(uri.fsPath),
                            languageId: editor?.document.languageId ?? 'unknown',
                            source: 'diagnostics'
                        });
                    } catch (err) {
                        console.warn(`Dev-Context: Ingesting diagnostics skipped, backend offline (${err instanceof Error ? err.message : String(err)})`);
                    }
                }
            }, 3000);
        })
    );

    vscode.commands.executeCommand('setContext', 'devContext.enabled', true);
    console.log('Dev-Context Assistant: activated successfully');
}

// ─── Deactivate ────────────────────────────────────────────────────────────────
export function deactivate(): void {
    vscode.commands.executeCommand('setContext', 'devContext.enabled', false);
    console.log('Dev-Context Assistant: deactivated');
}
