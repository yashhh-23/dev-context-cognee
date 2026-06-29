import * as vscode from 'vscode';
import { ApiClient } from '../utils/apiClient';
import { summarizeDocumentStructure } from '../utils/languageDetector';
import { StatusSetter, ProviderBridge } from './rememberContext';

export function registerDraftIssueCommand(
  context: vscode.ExtensionContext,
  provider: ProviderBridge,
  status: StatusSetter
): vscode.Disposable {
  return vscode.commands.registerCommand('devContext.draftGitHubIssue', async () => {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      vscode.window.showWarningMessage('Dev-Context: No active file open. Open a file first.');
      return;
    }

    const document = editor.document;
    const summary = summarizeDocumentStructure(document);
    const selectedSnippet = document.getText(editor.selection).trim();
    const codeSnippet = selectedSnippet || document.getText().slice(0, 2000);

    status.syncing();

    try {
      const api = new ApiClient({ context });
      const result = await api.draftIssue({
        fileName: vscode.workspace.asRelativePath(document.fileName),
        languageId: document.languageId,
        codeSnippet
      });

      const title = result.title?.trim() || `Bug report: ${vscode.workspace.asRelativePath(document.fileName)}`;
      const body = result.body?.trim() || 'No issue body was returned by the backend.';
      const content = [
        `# ${title}`,
        '',
        `- File: \`${vscode.workspace.asRelativePath(document.fileName)}\``,
        `- Language: ${summary.displayName}`,
        `- Symbols detected: ${summary.symbols.slice(0, 10).join(', ') || 'None'}`,
        '',
        '## Draft',
        '',
        body,
        '',
        '## Code Snippet',
        '',
        '```',
        codeSnippet,
        '```'
      ].join('\n');

      const issueDoc = await vscode.workspace.openTextDocument({
        language: 'markdown',
        content
      });

      await vscode.window.showTextDocument(issueDoc, {
        preview: false,
        viewColumn: vscode.ViewColumn.Beside
      });

      provider.postMessageToWebview?.({
        type: 'issueDrafted',
        payload: {
          title,
          fileName: vscode.workspace.asRelativePath(document.fileName)
        }
      });

      status.done('Issue drafted ✓');
      vscode.window.showInformationMessage('Dev-Context: GitHub issue draft opened in a new tab.');
    } catch (err: unknown) {
      status.error();
      const message = err instanceof Error ? err.message : String(err);
      vscode.window.showErrorMessage(`Dev-Context: Draft failed — ${message}`);
    }
  });
}
