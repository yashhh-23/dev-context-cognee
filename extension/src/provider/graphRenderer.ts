export interface BugNode {
  title: string;
  file: string;
  similarity: number;
  summary?: string;
}

export function renderMemoryGraph(bugs: BugNode[]): string {
  if (!bugs || bugs.length === 0) {
    return `
      <div class="graph-empty">
        <span class="graph-empty-icon">🔗</span>
        <p>Save and recall contexts to see memory connections here.</p>
      </div>
    `;
  }

  const nodes = bugs
    .map(
      (bug, i) => `
      <div
        class="graph-node"
        data-file="${escapeHtml(bug.file)}"
        onclick="nodeClicked('${escapeHtml(bug.file)}')"
        title="${escapeHtml(bug.summary || bug.title)}"
      >
        <div class="graph-node-header">
          <span class="graph-node-icon">📄</span>
          <span class="graph-node-file">${escapeHtml(shortFile(bug.file))}</span>
          <span class="graph-node-score ${similarityClass(bug.similarity)}">
            ${Math.round(bug.similarity * 100)}%
          </span>
        </div>
        <div class="graph-node-title">${escapeHtml(bug.title)}</div>
        ${i < bugs.length - 1 ? '<div class="graph-edge">│</div>' : ''}
      </div>
    `
    )
    .join('');

  return `
    <div class="graph-container">
      <div class="graph-title">Memory Connections (${bugs.length})</div>
      <div class="graph-nodes">${nodes}</div>
    </div>

    <style>
      .graph-container { margin: 8px 0; }
      .graph-title { font-size: 11px; color: var(--vscode-descriptionForeground); margin-bottom: 6px; text-transform: uppercase; letter-spacing: 0.5px; }
      .graph-nodes { display: flex; flex-direction: column; gap: 0; }
      .graph-node {
        background: var(--vscode-editor-inactiveSelectionBackground);
        border: 1px solid var(--vscode-panel-border);
        border-radius: 6px;
        padding: 8px 10px;
        cursor: pointer;
        transition: background 0.15s;
      }
      .graph-node:hover { background: var(--vscode-list-hoverBackground); }
      .graph-node-header { display: flex; align-items: center; gap: 6px; margin-bottom: 3px; }
      .graph-node-icon { font-size: 12px; }
      .graph-node-file { font-size: 12px; font-weight: 600; color: var(--vscode-foreground); flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .graph-node-score { font-size: 10px; font-weight: 700; padding: 1px 5px; border-radius: 10px; }
      .score-high { background: #1a4731; color: #4ade80; }
      .score-mid  { background: #3d2e00; color: #facc15; }
      .score-low  { background: #3b1a1a; color: #f87171; }
      .graph-node-title { font-size: 11px; color: var(--vscode-descriptionForeground); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .graph-edge { text-align: center; color: var(--vscode-panel-border); line-height: 1; margin: 2px 0; font-size: 14px; }
      .graph-empty { text-align: center; padding: 16px; color: var(--vscode-descriptionForeground); }
      .graph-empty-icon { font-size: 24px; display: block; margin-bottom: 6px; }
      .graph-empty p { font-size: 11px; margin: 0; }
    </style>
  `;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function shortFile(filepath: string): string {
  return filepath.split('/').pop() || filepath;
}

function similarityClass(score: number): string {
  if (score >= 0.75) return 'score-high';
  if (score >= 0.5) return 'score-mid';
  return 'score-low';
}
