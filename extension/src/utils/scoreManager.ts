import { StateManager } from './stateManager';

const SCORE_KEY = 'devContext.sessionScore';

const SCORE_RULES = {
  save: 10,
  recall: 5,
  improve: 15,
  forget: 5,
  draft: 8,
} as const;

export type ScoreAction = keyof typeof SCORE_RULES;

export class ScoreManager {
  private stateManager: StateManager;

  constructor(stateManager: StateManager) {
    this.stateManager = stateManager;
  }

  addPoints(points: number): number {
    const current = this.getScore();
    const next = current + points;
    this.stateManager.set(SCORE_KEY, next);
    return next;
  }

  addForAction(action: ScoreAction): number {
    return this.addPoints(SCORE_RULES[action]);
  }

  getScore(): number {
    return this.stateManager.get<number>(SCORE_KEY) ?? 0;
  }

  resetScore(): void {
    this.stateManager.clear(SCORE_KEY);
  }

  getRules(): typeof SCORE_RULES {
    return SCORE_RULES;
  }
}
