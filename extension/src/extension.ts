import * as vscode from 'vscode';
import { DevContextWebViewProvider } from './provider';
import { registerRememberContextCommand, ProviderBridge, StatusSetter } from './commands/rememberContext';
import { registerRecallBugsCommand } from './commands/recallBugs';
import { registerDraftIssueCommand } from './commands/draftIssue';

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
    const provider = new DevContextWebViewProvider(context.extensionUri);
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

    // 4. Commands
    context.subscriptions.push(
        registerRememberContextCommand(context, bridge, status),
        registerRecallBugsCommand(context, bridge, status),
        registerDraftIssueCommand(context, bridge, status)
    );

    // 5. File watcher: auto-refresh context bar on text change
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

    // 6. Tab switch: refresh context bar when active editor changes
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
