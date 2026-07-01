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
  private onMilestone?: (pts: number) => void;

  constructor(stateManager: StateManager, onMilestone?: (pts: number) => void) {
    this.stateManager = stateManager;
    this.onMilestone = onMilestone;
  }

  addPoints(points: number): number {
    const current = this.getScore();
    const next = current + points;
    this.stateManager.set(SCORE_KEY, next);

    if (this.onMilestone) {
      if (current < 25 && next >= 25)  { this.onMilestone(25); }
      else if (current < 50 && next >= 50)  { this.onMilestone(50); }
      else if (current < 100 && next >= 100) { this.onMilestone(100); }
    }

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
