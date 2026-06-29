import * as vscode from 'vscode';
import * as cp from 'child_process';
import * as path from 'path';

export function activate(context: vscode.ExtensionContext) {
    let disposable = vscode.commands.registerCommand('cognee.sendToMemory', () => {
        // Get active text editor
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showInformationMessage('Open a file and select text to send to Cognee.');
            return;
        }

        const selection = editor.selection;
        const text = editor.document.getText(selection);

        if (!text) {
            vscode.window.showInformationMessage('No text selected.');
            return;
        }

        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders) {
            vscode.window.showErrorMessage('No workspace folder open.');
            return;
        }

        const workspacePath = workspaceFolders[0].uri.fsPath;
        // Assume cli is in the workspace root at /cli/cognee_cli.py
        const cliScript = path.join(workspacePath, 'cli', 'cognee_cli.py');

        vscode.window.showInformationMessage('Sending selection to Cognee...');

        // Execute the python CLI script, passing text via stdin
        const child = cp.spawn('python', [cliScript], { cwd: workspacePath });

        child.stdin.write(text);
        child.stdin.end();

        let stdout = '';
        let stderr = '';

        child.stdout.on('data', (data) => { stdout += data.toString(); });
        child.stderr.on('data', (data) => { stderr += data.toString(); });

        child.on('close', (code) => {
            if (code === 0) {
                vscode.window.showInformationMessage('Cognee: Successfully ingested data!');
            } else {
                vscode.window.showErrorMessage(`Cognee Error: ${stderr || stdout}`);
            }
        });
    });

    context.subscriptions.push(disposable);
}

export function deactivate() {}
