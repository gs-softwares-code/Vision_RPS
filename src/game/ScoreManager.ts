/**
 * ScoreManager.ts — tracks player/computer wins, draws, total rounds.
 * Persistence is delegated to an injectable storage adapter (LocalStorage).
 */

export const RESULT = { WIN: 'win', LOSE: 'lose', DRAW: 'draw' } as const;

export type RoundResult = (typeof RESULT)[keyof typeof RESULT];

export interface StorageAdapter {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface ScoreSnapshot {
  playerWins: number;
  computerWins: number;
  draws: number;
  totalRounds: number;
  winPercentage: number;
}

export interface ScoreManagerOptions {
  storage?: StorageAdapter | null;
  storageKey?: string;
}

export class ScoreManager {
  readonly storage: StorageAdapter | null;
  readonly storageKey: string;

  playerWins = 0;
  computerWins = 0;
  draws = 0;
  totalRounds = 0;

  constructor(options: ScoreManagerOptions = {}) {
    this.storage = options.storage ?? null;
    this.storageKey = options.storageKey ?? 'vision-rps:score';
    this.reset();
    this.load();
  }

  reset(): void {
    this.playerWins = 0;
    this.computerWins = 0;
    this.draws = 0;
    this.totalRounds = 0;
  }

  record(result: RoundResult): void {
    if (result === RESULT.WIN) this.playerWins += 1;
    else if (result === RESULT.LOSE) this.computerWins += 1;
    else if (result === RESULT.DRAW) this.draws += 1;
    else return;
    this.totalRounds += 1;
    this.save();
  }

  winPercentage(): number {
    if (!this.totalRounds) return 0;
    return Math.round((this.playerWins / this.totalRounds) * 1000) / 10;
  }

  snapshot(): ScoreSnapshot {
    return {
      playerWins: this.playerWins,
      computerWins: this.computerWins,
      draws: this.draws,
      totalRounds: this.totalRounds,
      winPercentage: this.winPercentage(),
    };
  }

  save(): void {
    if (!this.storage) return;
    this.storage.setItem(this.storageKey, JSON.stringify(this.snapshot()));
  }

  load(): void {
    if (!this.storage) return;
    try {
      const raw = this.storage.getItem(this.storageKey);
      if (!raw) return;
      const data = JSON.parse(raw) as Partial<ScoreSnapshot>;
      this.playerWins = Number(data.playerWins) || 0;
      this.computerWins = Number(data.computerWins) || 0;
      this.draws = Number(data.draws) || 0;
      this.totalRounds = this.playerWins + this.computerWins + this.draws;
    } catch {
      this.reset();
    }
  }

  resetPersisted(): void {
    this.reset();
    this.storage?.removeItem(this.storageKey);
  }
}
