import * as vscode from 'vscode';
import { ApiClient } from '../utils/apiClient';
import { summarizeDocumentStructure } from '../utils/languageDetector';

export type StatusSetter = {
  syncing: () => void;
  done: (message?: string) => void;
  error: () => void;
};

export type ProviderBridge = {
  updateContextSummary?: (document?: vscode.TextDocument) => Promise<void>;
  postMessageToWebview?: (message: unknown) => void;
};

export function registerRememberContextCommand(
  context: vscode.ExtensionContext,
  provider: ProviderBridge,
  status: StatusSetter
): vscode.Disposable {
  return vscode.commands.registerCommand('devContext.rememberContext', async () => {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      vscode.window.showWarningMessage('Dev-Context: No active file open. Open a file first.');
      return;
    }

    if (!vscode.workspace.workspaceFolders?.length) {
      vscode.window.showErrorMessage('Dev-Context: No workspace folder open. Open a project folder first.');
      return;
    }

    const api = new ApiClient({ context });
    const document = editor.document;
    const summary = summarizeDocumentStructure(document);

    status.syncing();

    try {
      // Native VS Code symbols provider (LSP-backed)
      let symbolNames: string[] = [];
      try {
        const symbols = await vscode.commands.executeCommand<vscode.DocumentSymbol[]>(
          'vscode.executeDocumentSymbolProvider',
          document.uri
        );
        symbolNames = symbols?.flatMap(s => [s.name, ...s.children.map(c => c.name)]) ?? [];
      } catch {
        symbolNames = summary.symbols;
      }

      await api.ingestContext({
        content: document.getText(),
        fileName: vscode.workspace.asRelativePath(document.fileName),
        languageId: document.languageId,
        source: 'vscode-extension',
        symbols: symbolNames
      });

      status.done('Saved ✓');

      provider.postMessageToWebview?.({
        type: 'rememberSuccess',
        payload: {
          fileName: vscode.workspace.asRelativePath(document.fileName),
          languageId: summary.displayName,
          importsCount: summary.imports.length,
          symbolsCount: summary.symbols.length,
          lineCount: summary.lineCount
        }
      });

      await provider.updateContextSummary?.(document);

      vscode.window.showInformationMessage(
        `Dev-Context: Context saved to Cognee for ${summary.displayName}.`
      );
    } catch (err: unknown) {
      status.error();
      const message = err instanceof Error ? err.message : String(err);
      vscode.window.showErrorMessage(`Dev-Context: Failed to save context — ${message}`);
    }
  });
}
