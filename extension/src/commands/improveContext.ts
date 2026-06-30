import * as vscode from 'vscode';
import { ApiClient } from '../utils/apiClient';
import { ScoreManager } from '../utils/scoreManager';

export async function improveContext(
  context: vscode.ExtensionContext,
  apiClient: ApiClient,
  scoreManager: ScoreManager
): Promise<void> {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    vscode.window.showWarningMessage('Dev-Context: No active editor found.');
    return;
  }

  const document = editor.document;
  const filename = document.fileName.split('/').pop() || document.fileName;
  const language = document.languageId;

  // Use selection if present, otherwise first 2000 chars
  const selection = editor.selection;
  const content = !selection.isEmpty
    ? document.getText(selection)
    : document.getText().slice(0, 2000);

  if (!content.trim()) {
    vscode.window.showWarningMessage('Dev-Context: No content to improve.');
    return;
  }

  await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: 'Dev-Context: Improving context...',
      cancellable: false,
    },
    async () => {
      try {
        const result = await apiClient.post<{ status: string; score_bonus: number }>('/api/memify', {
          filename,
          content,
          language,
        });

        const bonus = result?.score_bonus ?? 15;
        scoreManager.addPoints(bonus);
        const total = scoreManager.getScore();

        vscode.window.showInformationMessage(
          `Dev-Context: Context improved ✓ +${bonus} points (Total: ${total})`
        );

        // Notify sidebar to update
        vscode.commands.executeCommand('devContext.refreshSidebar', {
          type: 'improved',
          filename,
          score: total,
        });
      } catch (err: any) {
        vscode.window.showErrorMessage(`Dev-Context: Improve failed — ${err.message}`);
      }
    }
  );
}
