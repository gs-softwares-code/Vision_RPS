/**
 * ComputerOpponent.ts — distinct opponent personalities.
 *
 * - Random:     uniform random move (fair default).
 * - Adaptive:   counters the player's most frequent recent move.
 * - Predictive: estimates the player's likely next move from recent history
 *               (first-order Markov on last move) and plays the counter.
 * - Challenge:  configurable difficulty profile (random vs. counter ratio).
 *
 * Honesty rules (per product spec):
 *  - No opponent ever sees the *current* locked move before choosing.
 *  - Random remains genuinely random (no hidden manipulation).
 *  - Non-random behavior is labeled and documented.
 */

import { GESTURES, type Gesture } from '../vision/GestureClassifier';

export const COMPUTER_MOVES: Gesture[] = [GESTURES.ROCK, GESTURES.PAPER, GESTURES.SCISSORS];

/** Move that beats the given move. */
export function counterTo(move: Gesture): Gesture {
  if (move === GESTURES.ROCK) return GESTURES.PAPER;
  if (move === GESTURES.PAPER) return GESTURES.SCISSORS;
  return GESTURES.ROCK;
}

export interface ComputerOpponent {
  readonly name: string;
  isAdaptive?: boolean;
  move(): Gesture;
}

export interface OpponentOptions {
  random?: () => number;
}

export class RandomOpponent implements ComputerOpponent {
  name = 'Random';
  random: () => number;

  constructor(options: OpponentOptions = {}) {
    this.random = options.random ?? Math.random;
  }

  move(): Gesture {
    const idx = Math.min(COMPUTER_MOVES.length - 1, Math.floor(this.random() * COMPUTER_MOVES.length));
    return COMPUTER_MOVES[idx];
  }
}

/**
 * Adaptive: observes the player's past moves and counters the most frequent
 * one. Swings gradually; still nondeterministic before it has data.
 */
export class AdaptiveOpponent implements ComputerOpponent {
  name = 'Adaptive';
  isAdaptive = true;
  random: () => number;
  private counts: Partial<Record<Gesture, number>> = { rock: 0, paper: 0, scissors: 0 };
  private seen = 0;

  constructor(options: OpponentOptions = {}) {
    this.random = options.random ?? Math.random;
  }

  observe(playerMove: Gesture): void {
    if (COMPUTER_MOVES.includes(playerMove)) {
      this.counts[playerMove] = (this.counts[playerMove] ?? 0) + 1;
      this.seen += 1;
    }
  }

  move(): Gesture {
    if (this.seen === 0) {
      const idx = Math.min(2, Math.floor(this.random() * 3));
      return COMPUTER_MOVES[idx];
    }
    const mostFrequent = COMPUTER_MOVES.reduce((a, b) =>
      (this.counts[b] ?? 0) > (this.counts[a] ?? 0) ? b : a,
    );
    return counterTo(mostFrequent);
  }
}

/**
 * Predictive: works from the player's *last* move. Maintains a transition
 * matrix (prevMove -> nextMove counts) and guesses the most likely next move,
 * then counters it. Falls back to uniform until it has seen a pair.
 */
export class PredictiveOpponent implements ComputerOpponent {
  name = 'Predictive';
  isAdaptive = true;
  random: () => number;
  private last: Gesture | null = null;
  private transitions: Record<string, Partial<Record<Gesture, number>>> = {};

  constructor(options: OpponentOptions = {}) {
    this.random = options.random ?? Math.random;
  }

  observe(playerMove: Gesture): void {
    if (!COMPUTER_MOVES.includes(playerMove)) return;
    if (this.last) {
      const key = this.last;
      this.transitions[key] ??= { rock: 0, paper: 0, scissors: 0 };
      this.transitions[key][playerMove] = (this.transitions[key][playerMove] ?? 0) + 1;
    }
    this.last = playerMove;
  }

  move(): Gesture {
    const key = this.last;
    if (key && this.transitions[key]) {
      const table = this.transitions[key];
      const predicted = COMPUTER_MOVES.reduce((a, b) =>
        (table[b] ?? 0) > (table[a] ?? 0) ? b : a,
      );
      if ((table[predicted] ?? 0) > 0) return counterTo(predicted);
    }
    const idx = Math.min(2, Math.floor(this.random() * 3));
    return COMPUTER_MOVES[idx];
  }
}

export type ChallengeDifficulty = 'easy' | 'normal' | 'hard';

/**
 * Challenge: a difficulty profile. `counterRatio` is the probability the bot
 * plays a strategic counter; otherwise it plays uniformly random.
 */
export class ChallengeOpponent implements ComputerOpponent {
  name = 'Challenge';
  isAdaptive = true;
  random: () => number;
  counterRatio: number;
  difficulty: ChallengeDifficulty;

  constructor(options: OpponentOptions & { difficulty?: ChallengeDifficulty } = {}) {
    this.random = options.random ?? Math.random;
    this.difficulty = options.difficulty ?? 'normal';
    this.counterRatio = { easy: 0.2, normal: 0.5, hard: 0.8 }[this.difficulty];
  }

  move(): Gesture {
    if (this.random() < this.counterRatio) {
      const idx = Math.min(2, Math.floor(this.random() * 3));
      return counterTo(COMPUTER_MOVES[idx]);
    }
    const idx = Math.min(2, Math.floor(this.random() * 3));
    return COMPUTER_MOVES[idx];
  }
}

export type OpponentKind = 'random' | 'adaptive' | 'predictive' | 'challenge';

export function createOpponent(kind: OpponentKind, options: OpponentOptions & { difficulty?: ChallengeDifficulty } = {}): ComputerOpponent {
  switch (kind) {
    case 'adaptive':
      return new AdaptiveOpponent(options);
    case 'predictive':
      return new PredictiveOpponent(options);
    case 'challenge':
      return new ChallengeOpponent(options);
    default:
      return new RandomOpponent(options);
  }
}
