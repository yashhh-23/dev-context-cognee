import * as vscode from 'vscode';

export class StateManager {
  private memento: vscode.Memento;

  constructor(context: vscode.ExtensionContext) {
    this.memento = context.workspaceState;
  }

  get<T>(key: string): T | undefined {
    return this.memento.get<T>(key);
  }

  async set<T>(key: string, value: T): Promise<void> {
    await this.memento.update(key, value);
  }

  async clear(key: string): Promise<void> {
    await this.memento.update(key, undefined);
  }

  async clearAll(keys: string[]): Promise<void> {
    await Promise.all(keys.map((k) => this.clear(k)));
  }
}
