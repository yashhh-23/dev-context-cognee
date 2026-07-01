import * as vscode from 'vscode';
import { ApiClient } from '../utils/apiClient';
import { summarizeDocumentStructure, isSupportedLanguage } from '../utils/languageDetector';
import { StatusSetter, ProviderBridge } from './rememberContext';
import { applyBugDecorations } from '../decorations/bugDecorator';

export function registerRecallBugsCommand(
  context: vscode.ExtensionContext,
  provider: ProviderBridge,
  status: StatusSetter
): vscode.Disposable {
  return vscode.commands.registerCommand('devContext.recallSimilarBugs', async () => {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      vscode.window.showWarningMessage('Dev-Context: No active file open. Open a file first.');
      return;
    }

    const document = editor.document;
    const summary = summarizeDocumentStructure(document);
    const threshold = vscode.workspace
      .getConfiguration('devContext')
      .get<number>('similarityThreshold', 0.75);

    const selectedText = document.getText(editor.selection).trim();
    const fallbackQuery = [
      `Language: ${summary.displayName}`,
      summary.symbols.length ? `Symbols: ${summary.symbols.slice(0, 8).join(', ')}` : '',
      summary.imports.length ? `Imports: ${summary.imports.slice(0, 6).join(', ')}` : '',
      document.getText().slice(0, 1500)
    ]
      .filter(Boolean)
      .join('\n');

    status.syncing();

    try {
      const api = new ApiClient({ context });
      const result = await api.recallSimilarBugs({
        query: selectedText || fallbackQuery,
        languageId: document.languageId,
        similarityThreshold: threshold
      });

      const bugs = Array.isArray(result.bugs) ? result.bugs : [];
      const mappedBugs = bugs.map(bug => ({
        ...bug,
        qa_id: bug.id || bug.qa_id || bug.node_id
      }));
      const languageNote = isSupportedLanguage(document.languageId)
        ? summary.displayName
        : `${summary.displayName} (fallback mode)`;

      provider.postMessageToWebview?.({
        type: 'bugsUpdate',
        payload: {
          bugs: mappedBugs,
          language: languageNote,
          threshold
        }
      });

      // Apply inline editor decorations
      applyBugDecorations(editor, bugs as any);

      status.done(`${bugs.length} bug(s)`);

      if (bugs.length > 0) {
        vscode.window.showInformationMessage(
          `Dev-Context: ${bugs.length} similar bug(s) recalled for ${languageNote}.`
        );
      } else {
        vscode.window.showInformationMessage(
          `Dev-Context: No similar bugs found for ${languageNote}.`
        );
      }
    } catch (err: unknown) {
      status.error();
      const message = err instanceof Error ? err.message : String(err);
      vscode.window.showErrorMessage(`Dev-Context: Recall failed — ${message}`);
    }
  });
}
