import * as vscode from 'vscode';

export type LanguageProfile = {
  languageId: string;
  displayName: string;
  fileExtensions: string[];
  importPatterns: RegExp[];
  functionPatterns: RegExp[];
};

const LANGUAGE_PROFILES: Record<string, LanguageProfile> = {
  python: {
    languageId: 'python',
    displayName: 'Python',
    fileExtensions: ['.py'],
    importPatterns: [/^\s*import\s+.+$/gm, /^\s*from\s+.+\s+import\s+.+$/gm],
    functionPatterns: [/^\s*def\s+([a-zA-Z0-9_]+)\s*\(/gm, /^\s*class\s+([a-zA-Z0-9_]+)/gm]
  },
  javascript: {
    languageId: 'javascript',
    displayName: 'JavaScript',
    fileExtensions: ['.js', '.mjs', '.cjs'],
    importPatterns: [/^\s*import\s+.+\s+from\s+.+$/gm, /^\s*const\s+.+\s*=\s*require\(.+\)$/gm],
    functionPatterns: [/function\s+([a-zA-Z0-9_]+)\s*\(/gm, /const\s+([a-zA-Z0-9_]+)\s*=\s*\(.+=>/gm]
  },
  typescript: {
    languageId: 'typescript',
    displayName: 'TypeScript',
    fileExtensions: ['.ts', '.tsx'],
    importPatterns: [/^\s*import\s+.+\s+from\s+.+$/gm],
    functionPatterns: [/function\s+([a-zA-Z0-9_]+)\s*\(/gm, /const\s+([a-zA-Z0-9_]+)\s*=\s*\(.+=>/gm]
  },
  go: {
    languageId: 'go',
    displayName: 'Go',
    fileExtensions: ['.go'],
    importPatterns: [/^\s*import\s+\(.+?\)/gms, /^\s*import\s+".+"$/gm],
    functionPatterns: [/^\s*func\s+([a-zA-Z0-9_]+)\s*\(/gm, /^\s*type\s+([a-zA-Z0-9_]+)\s+struct/gm]
  },
  rust: {
    languageId: 'rust',
    displayName: 'Rust',
    fileExtensions: ['.rs'],
    importPatterns: [/^\s*use\s+.+;$/gm],
    functionPatterns: [/^\s*fn\s+([a-zA-Z0-9_]+)\s*\(/gm, /^\s*struct\s+([a-zA-Z0-9_]+)/gm]
  },
  java: {
    languageId: 'java',
    displayName: 'Java',
    fileExtensions: ['.java'],
    importPatterns: [/^\s*import\s+.+;$/gm],
    functionPatterns: [/\b(?:public|private|protected)?\s*(?:static\s+)?[A-Za-z0-9_<>,\[\]]+\s+([a-zA-Z0-9_]+)\s*\(/gm]
  }
};

const FALLBACK_PROFILE: LanguageProfile = {
  languageId: 'plaintext',
  displayName: 'Plain Text',
  fileExtensions: [],
  importPatterns: [],
  functionPatterns: []
};

export function getLanguageProfile(languageId: string): LanguageProfile {
  return LANGUAGE_PROFILES[languageId] ?? FALLBACK_PROFILE;
}

export function summarizeDocumentStructure(document: vscode.TextDocument) {
  const profile = getLanguageProfile(document.languageId);
  const text = document.getText();

  const imports = profile.importPatterns.flatMap(pattern =>
    Array.from(text.matchAll(pattern)).map(m => m[0].trim())
  );
  const symbols = profile.functionPatterns.flatMap(pattern =>
    Array.from(text.matchAll(pattern)).map(m => m[1]).filter(Boolean)
  );

  return {
    languageId: profile.languageId,
    displayName: profile.displayName,
    imports: dedupe(imports).slice(0, 20),
    symbols: dedupe(symbols).slice(0, 30),
    lineCount: document.lineCount
  };
}

export function isSupportedLanguage(languageId: string): boolean {
  return languageId in LANGUAGE_PROFILES;
}

function dedupe<T>(items: T[]): T[] {
  return [...new Set(items)];
}
