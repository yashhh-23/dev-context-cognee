import * as vscode from 'vscode';
import { ApiClient } from '../utils/apiClient';
import { StatusSetter, ProviderBridge } from './rememberContext';

export function registerRememberChangedFilesCommand(
  context: vscode.ExtensionContext,
  provider: ProviderBridge,
  status: StatusSetter
): vscode.Disposable {
  return vscode.commands.registerCommand('devContext.rememberChangedFiles', async () => {
    status.syncing();
    try {
      const gitExtension = vscode.extensions.getExtension('vscode.git')?.exports;
      if (!gitExtension) {
        vscode.window.showWarningMessage('Dev-Context: Git extension not found.');
        status.error();
        return;
      }
      const git = gitExtension.getAPI(1);
      if (!git || !git.repositories.length) {
        vscode.window.showWarningMessage('Dev-Context: No git repositories found.');
        status.error();
        return;
      }

      const repo = git.repositories[0];
      const changedFiles = repo.state.workingTreeChanges;
      if (!changedFiles || changedFiles.length === 0) {
        vscode.window.showInformationMessage('Dev-Context: No modified files found in working tree.');
        status.done('No changes');
        return;
      }

      const api = new ApiClient({ context });
      const maxFiles = 10;
      const filesToIngest = changedFiles.slice(0, maxFiles);
      
      vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: "Dev-Context: Ingesting modified files...",
        cancellable: false
      }, async (progress) => {
        let count = 0;
        for (const change of filesToIngest) {
          try {
            const document = await vscode.workspace.openTextDocument(change.uri);
            const fileName = vscode.workspace.asRelativePath(change.uri);
            progress.report({ message: `Ingesting ${fileName} (${count + 1}/${filesToIngest.length})` });
            
            // Native VS Code symbols provider (LSP-backed)
            let symbolNames: string[] = [];
            try {
              const symbols = await vscode.commands.executeCommand<vscode.DocumentSymbol[]>(
                'vscode.executeDocumentSymbolProvider',
                change.uri
              );
              symbolNames = symbols?.flatMap(s => [s.name, ...s.children.map(c => c.name)]) ?? [];
            } catch {
              // Fallback if symbol provider fails or is not registered for this file type
            }

            await api.ingestContext({
              content: document.getText(),
              fileName: fileName,
              languageId: document.languageId,
              source: 'git-changes',
              symbols: symbolNames
            });
            count++;
          } catch (e) {
            console.error(`Failed to ingest ${change.uri.fsPath}:`, e);
          }
        }
        
        status.done(`Saved ${count} ✓`);
        vscode.window.showInformationMessage(`Dev-Context: Ingested ${count} modified file(s) into Cognee.`);
      });

    } catch (err: unknown) {
      status.error();
      const message = err instanceof Error ? err.message : String(err);
      vscode.window.showErrorMessage(`Dev-Context: Failed to remember changed files — ${message}`);
    }
  });
}
