import * as vscode from 'vscode';
import { ApiClient } from '../utils/apiClient';
import { ScoreManager } from '../utils/scoreManager';

export async function forgetContext(
  context: vscode.ExtensionContext,
  apiClient: ApiClient,
  scoreManager: ScoreManager
): Promise<void> {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    vscode.window.showWarningMessage('Dev-Context: No active editor found.');
    return;
  }

  const filename = editor.document.fileName.split('/').pop() || editor.document.fileName;

  // Confirmation dialog
  const choice = await vscode.window.showQuickPick(
    [
      { label: '$(check) Yes, delete it', value: 'yes' },
      { label: '$(x) No, keep it', value: 'no' },
    ],
    {
      placeHolder: `Delete saved context for "${filename}"? This cannot be undone.`,
      title: 'Dev-Context: Forget Context',
    }
  );

  if (!choice || choice.value !== 'yes') {
    return;
  }

  await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: 'Dev-Context: Deleting context...',
      cancellable: false,
    },
    async () => {
      try {
        const result = await apiClient.post<{ status: string; score_bonus: number }>('/api/forget', {
          filename,
        });

        const bonus = result?.score_bonus ?? 5;
        scoreManager.addPoints(bonus);
        const total = scoreManager.getScore();

        vscode.window.showInformationMessage(
          `Dev-Context: Context deleted ✓ +${bonus} points (Total: ${total})`
        );

        // Notify sidebar to remove entry
        vscode.commands.executeCommand('devContext.refreshSidebar', {
          type: 'forgotten',
          filename,
          score: total,
        });
      } catch (err: any) {
        vscode.window.showErrorMessage(`Dev-Context: Forget failed — ${err.message}`);
      }
    }
  );
}
