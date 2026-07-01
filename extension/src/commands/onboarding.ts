import * as vscode from 'vscode';
import { ApiClient } from '../utils/apiClient';

export async function runOnboarding(context: vscode.ExtensionContext, api: ApiClient): Promise<void> {
    if (context.globalState.get('devContext.onboardingDone')) {
        return;
    }

    vscode.window.showInformationMessage("👋 Welcome to Dev-Context! Let's get you set up.");

    const backendUrl = await vscode.window.showInputBox({
        prompt: "Backend URL",
        placeHolder: "http://localhost:8000"
    });
    if (backendUrl === undefined) return;
    if (backendUrl) {
        await vscode.workspace.getConfiguration('devContext').update('backendUrl', backendUrl, vscode.ConfigurationTarget.Global);
    }

    const apiKey = await vscode.window.showInputBox({
        prompt: "Cognee API Key (stored securely)",
        password: true
    });
    if (apiKey === undefined) return;
    if (apiKey) {
        await context.secrets.store('devContext.cogneeApiKey', apiKey);
    }

    try {
        const url = vscode.workspace.getConfiguration('devContext').get<string>('backendUrl', 'http://localhost:8000');
        const fetchUrl = url.endsWith('/') ? `${url}health` : `${url}/health`;
        const res = await fetch(fetchUrl);
        if (res.ok) {
            vscode.window.showInformationMessage("✅ Backend connected! You're ready to go.");
        } else {
            vscode.window.showWarningMessage("⚠️ Could not reach backend. Check your URL and try again.");
        }
    } catch (err) {
        vscode.window.showWarningMessage("⚠️ Could not reach backend. Check your URL and try again.");
    }

    vscode.window.showInformationMessage("💡 Open any file and press Cmd+Shift+M to save your first context to Cognee memory.");
    await context.globalState.update('devContext.onboardingDone', true);
}
