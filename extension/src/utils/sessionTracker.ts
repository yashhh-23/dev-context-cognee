import { StateManager } from './stateManager';

export class SessionTracker {
  constructor(private stateManager: StateManager) {}

  increment(action: 'improved' | 'deleted' | 'saved' | 'recalled') {
    const stats = this.getStats();
    if (action === 'improved' || action === 'saved') {
      stats.filesSaved++;
    }
    if (action === 'recalled') {
      stats.bugsRecalled++;
    }
    this.stateManager.set('sessionTracker.stats', stats);
  }

  getStats(): { filesSaved: number, bugsRecalled: number } {
    return this.stateManager.get<{filesSaved: number, bugsRecalled: number}>('sessionTracker.stats') || { filesSaved: 0, bugsRecalled: 0 };
  }
}