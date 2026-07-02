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

    // 2. Sidebar WebView provider (full UI from provider.ts)
    const provider = new DevContextWebViewProvider(context.extensionUri, context);
    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider(
            DevContextWebViewProvider.viewType,
            provider,
            { webviewOptions: { retainContextWhenHidden: true } }
        )
    );

    // 3. Status + provider bridges for command modules
    const status: StatusSetter = {
        syncing: setStatusBarSyncing,
        done:    setStatusBarDone,
        error:   setStatusBarError
    };

    const bridge: ProviderBridge = {
        updateContextSummary: (doc) => provider.updateContextSummary(doc),
        postMessageToWebview: (msg) => provider.postMessageToWebview(msg)
    };

    // 4. API Client
    const api = new ApiClient({ context });
    const stateManager = new StateManager(context);
    const scoreManager = new ScoreManager(stateManager);

    // ─── Session Lifecycle ─────────────────────────────────────────────────────────
    const sessionId = `session_${Date.now()}_${vscode.env.machineId.slice(0, 8)}`;
    context.globalState.update('currentSessionId', sessionId);
    api.startSession({ sessionId, workspaceName: vscode.workspace.name || 'unnamed-workspace' })
        .then(() => console.log(`Dev-Context: Started session ${sessionId}`))
        .catch(err => console.error('Failed to start session:', err));

    // End session on deactivate
    context.subscriptions.push(
        new vscode.Disposable(() => {
            const currentSession = context.globalState.get<string>('currentSessionId') || sessionId;
            api.endSession({ sessionId: currentSession, triggerDistillation: true })
                .then(() => console.log(`Dev-Context: Ended session ${currentSession}`))
                .catch(err => console.error('Failed to end session:', err));
        })
    );

    // 5. Commands
    context.subscriptions.push(
        registerRememberContextCommand(context, bridge, status),
        registerRecallBugsCommand(context, bridge, status),
        registerDraftIssueCommand(context, bridge, status),
        registerRememberChangedFilesCommand(context, bridge, status),
        vscode.commands.registerCommand('devContext.improveContext', () =>
            improveContext(context, api, scoreManager)
        ),
        vscode.commands.registerCommand('devContext.forgetContext', () =>
            forgetContext(context, api, scoreManager)
        ),
        bugDecorationType
    );

    // 6. File watcher: auto-refresh context bar on text change
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

    // 7. Tab switch: refresh context bar when active editor changes
    context.subscriptions.push(
        vscode.window.onDidChangeActiveTextEditor(async (editor) => {
            if (editor && provider.isOpen) {
                await provider.updateContextSummary(editor.document);
            }
        })
    );

    // ─── Passive Auto-Save ─────────────────────────────────────────────────────────
    const autoSaveDisposable = vscode.workspace.onDidSaveTextDocument(async (document) => {
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
            setStatusBarDone('Saved ✓');
        } catch (err) {
            console.error('Auto-save failed:', err);
        }
    });
    context.subscriptions.push(autoSaveDisposable);

    // ─── Diagnostic Integration ────────────────────────────────────────────────────
    let diagnosticDebounceTimer: NodeJS.Timeout | undefined;
    const diagnosticsDisposable = vscode.languages.onDidChangeDiagnostics(async (event) => {
        const config = vscode.workspace.getConfiguration('devContext');
        if (!config.get<boolean>('feedDiagnosticsToCognee', true)) { return; }

        if (diagnosticDebounceTimer) {
            clearTimeout(diagnosticDebounceTimer);
        }

        diagnosticDebounceTimer = setTimeout(async () => {
            for (const uri of event.uris) {
                if (uri.scheme !== 'file') { continue; }
                const diagnostics = vscode.languages.getDiagnostics(uri);
                const errors = diagnostics.filter(d => d.severity === vscode.DiagnosticSeverity.Error);
                if (errors.length === 0) { continue; }

                const editor = vscode.window.visibleTextEditors.find(e => e.document.uri.toString() === uri.toString());
                const fileName = vscode.workspace.asRelativePath(uri.fsPath);

                try {
                    await api.ingestContext({
                        content: errors.map(e => `[${e.source || 'Diagnostic'}] Line ${e.range.start.line + 1}: ${e.message}`).join('\n'),
                        fileName: fileName,
                        languageId: editor?.document.languageId ?? 'unknown',
                        source: 'diagnostics'
                    });
                } catch (err) {
                    console.error('Ingesting diagnostics failed:', err);
                }
            }
        }, 3000);
    });
    context.subscriptions.push(diagnosticsDisposable);

    // 8. Set extension context flag
    vscode.commands.executeCommand('setContext', 'devContext.enabled', true);

    console.log('Dev-Context Assistant: activated successfully');
}

// ─── Deactivate ────────────────────────────────────────────────────────────────
export function deactivate(): void {
    vscode.commands.executeCommand('setContext', 'devContext.enabled', false);
    console.log('Dev-Context Assistant: deactivated');
}
