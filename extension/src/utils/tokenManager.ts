import * as vscode from 'vscode';

const SECRET_KEY = 'devContext.cogneeApiKey';

export async function getCogneeApiKey(
  context: vscode.ExtensionContext
): Promise<string | undefined> {
  const stored = await context.secrets.get(SECRET_KEY);
  if (stored) {
    return stored;
  }

  const configValue = vscode.workspace
    .getConfiguration('devContext')
    .get<string>('cogneeApiKey', '')
    .trim();

  if (configValue) {
    await context.secrets.store(SECRET_KEY, configValue);
    await vscode.workspace
      .getConfiguration('devContext')
      .update('cogneeApiKey', '', vscode.ConfigurationTarget.Global);
    return configValue;
  }

  return undefined;
}

export async function promptAndStoreCogneeApiKey(
  context: vscode.ExtensionContext
): Promise<string | undefined> {
  const input = await vscode.window.showInputBox({
    title: 'Cognee API Key',
    prompt: 'Enter your Cognee Cloud API key',
    placeHolder: 'cg_********************************',
    password: true,
    ignoreFocusOut: true,
    validateInput: (value) => {
      if (!value.trim()) {
        return 'API key is required';
      }
      if (value.trim().length < 10) {
        return 'API key looks too short';
      }
      return null;
    }
  });

  const trimmed = input?.trim();
  if (!trimmed) {
    return undefined;
  }

  await context.secrets.store(SECRET_KEY, trimmed);
  return trimmed;
}

export async function clearCogneeApiKey(
  context: vscode.ExtensionContext
): Promise<void> {
  await context.secrets.delete(SECRET_KEY);
}
