import * as vscode from 'vscode';

export type RecalledBug = {
  id: string;
  content: string;
  score: number;
  source?: string;
  lineHint?: number;
  summary?: string;
  sourceFile?: string;
};

const bugDecorationType = vscode.window.createTextEditorDecorationType({
  after: {
    contentText: ' ⚠ Similar bug recalled',
    color: '#f59e0b',
    fontStyle: 'italic'
  },
  backgroundColor: 'rgba(245, 158, 11, 0.08)',
  borderRadius: '3px',
  isWholeLine: true
});

export function applyBugDecorations(
  editor: vscode.TextEditor,
  bugs: RecalledBug[]
) {
  const decorations: vscode.DecorationOptions[] = [];

  bugs.forEach(bug => {
    let lineNum: number | undefined = bug.lineHint;

    // Heuristic 1: Extract line number from diagnostic error text (e.g., "Line 45: message")
    if (lineNum === undefined && bug.content) {
      const lineMatch = bug.content.match(/\b(?:line|L)\s*(\d+)\b/i);
      if (lineMatch) {
        lineNum = parseInt(lineMatch[1], 10);
      }
    }

    // Heuristic 2: If the bug mentions a symbol, find its definition line in the active document
    if (lineNum === undefined && bug.content) {
      // Try to find if a function/class name is defined in the document
      const symbolMatches = bug.content.match(/\b(?:function|class|const|let|def|func|fn)\s+([a-zA-Z0-9_]+)\b/i);
      if (symbolMatches && symbolMatches[1]) {
        const symbolName = symbolMatches[1];
        for (let i = 0; i < editor.document.lineCount; i++) {
          if (editor.document.lineAt(i).text.includes(symbolName)) {
            lineNum = i + 1; // 1-indexed for lineHint
            break;
          }
        }
      }
    }

    // If still no line is found, default to highlighting the first line to ensure visibility
    if (lineNum === undefined) {
      lineNum = 1;
    }

    // Guard: ensure line number is within document bounds
    if (lineNum < 1 || lineNum > editor.document.lineCount) {
      return;
    }

    const line = editor.document.lineAt(lineNum - 1);
    const summary = bug.summary || (bug.content.length > 200 ? bug.content.slice(0, 200) + '...' : bug.content);
    const sourceFile = bug.sourceFile || bug.source || 'Cognee Memory';

    decorations.push({
      range: line.range,
      hoverMessage: new vscode.MarkdownString(
        `**Recalled Memory** (${(bug.score * 100).toFixed(0)}% match)\n\n${summary}\n\n*From: ${sourceFile}*`
      )
    });
  });

  editor.setDecorations(bugDecorationType, decorations);
}
