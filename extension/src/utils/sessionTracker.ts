import { StateManager } from './stateManager';

const STATS_KEY = 'sessionTracker.stats';

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
    this.stateManager.set(STATS_KEY, stats);
  }

  getStats(): { filesSaved: number, bugsRecalled: number } {
    return this.stateManager.get<{ filesSaved: number, bugsRecalled: number }>(STATS_KEY)
      || { filesSaved: 0, bugsRecalled: 0 };
  }

  reset(): void {
    this.stateManager.clear(STATS_KEY);
  }
}