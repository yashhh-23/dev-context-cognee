import * as vscode from 'vscode';

const LOW_SIMILARITY_THRESHOLD = 0.6;

export function checkAndSuggestMemify(
  bugs: any[],
  context: vscode.ExtensionContext
): void {
  if (!bugs || bugs.length === 0) {
    // No results at all — definitely suggest memify
    _showMemifyPrompt('No similar contexts found in memory.');
    return;
  }

  // Check if ALL results are below threshold
  const allLow = bugs.every(bug => {
    const score = bug.score ?? bug.similarity ?? 0;
    return score < LOW_SIMILARITY_THRESHOLD;
  });

  if (allLow) {
    const topScore = Math.round((bugs[0].score ?? bugs[0].similarity ?? 0) * 100);
    _showMemifyPrompt(`Low similarity detected (best match: ${topScore}%).`);
  }
  // If any result ≥ threshold → good match found, do nothing
}

function _showMemifyPrompt(reason: string): void {
  vscode.window.showInformationMessage(
    `🔍 Dev-Context: ${reason} Memify this file to improve future recall?`,
    'Memify Now',
    'Dismiss'
  ).then(choice => {
    if (choice === 'Memify Now') {
      vscode.commands.executeCommand('devContext.improveContext');
    }
  });
}