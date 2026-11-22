/**
 * GameEngine.ts — deterministic, independently testable round state machine.
 *
 * Phases:
 *   idle      → lock(playerMove) → countdown
 *   countdown → shoot()          → revealed
 *   revealed  → next()           → idle
 *
 * Fairness: the computer's move is only chosen inside shoot(), i.e. AFTER
 * the player's gesture is locked. It never sees the player move beforehand.
 */

import { GESTURES, type Gesture } from '../vision/GestureClassifier';
import { RandomOpponent, createOpponent, type ComputerOpponent, type OpponentOptions, type OpponentKind } from './ComputerOpponent';
import { ScoreManager, RESULT, type RoundResult } from './ScoreManager';

export const VALID_MOVES: Gesture[] = [GESTURES.ROCK, GESTURES.PAPER, GESTURES.SCISSORS];

const BEATS: Partial<Record<Gesture, Gesture>> = {
  [GESTURES.ROCK]: GESTURES.SCISSORS,
  [GESTURES.SCISSORS]: GESTURES.PAPER,
  [GESTURES.PAPER]: GESTURES.ROCK,
};

/** Pure rule resolver. Returns 'win' | 'lose' | 'draw' | null. */
export function resolveRound(player: Gesture, computer: Gesture): RoundResult | null {
  if (!VALID_MOVES.includes(player) || !VALID_MOVES.includes(computer)) return null;
  if (player === computer) return RESULT.DRAW;
  return BEATS[player] === computer ? RESULT.WIN : RESULT.LOSE;
}

export type EnginePhase = 'idle' | 'countdown' | 'revealed';

export interface Round {
  number: number;
  player: Gesture;
  computer: Gesture;
  result: RoundResult;
  timestamp: number;
}

export interface EngineOptions {
  opponent?: ComputerOpponent | OpponentOptions;
  opponentKind?: OpponentKind;
  scores?: ScoreManager;
}

export class GameEngine {
  readonly opponent: ComputerOpponent;
  readonly scores: ScoreManager;

  rounds: Round[] = [];
  phase: EnginePhase = 'idle';
  roundNumber = 0;
  playerMove: Gesture | null = null;
  computerMove: Gesture | null = null;

  constructor(options: EngineOptions = {}) {
    this.opponent =
      options.opponent && 'move' in options.opponent
        ? (options.opponent as ComputerOpponent)
        : options.opponentKind
          ? createOpponent(options.opponentKind, options.opponent as OpponentOptions | undefined)
          : new RandomOpponent(options.opponent as OpponentOptions | undefined);
    this.scores = options.scores ?? new ScoreManager();
  }

  get canLock(): boolean {
    return this.phase === 'idle';
  }

  /** Lock the detected player gesture and enter the countdown phase. */
  lock(gesture: Gesture): void {
    if (!this.canLock) {
      throw new Error(`Cannot lock in phase "${this.phase}"`);
    }
    if (!VALID_MOVES.includes(gesture)) {
      throw new Error(`Invalid gesture: ${gesture}`);
    }
    this.playerMove = gesture;
    this.phase = 'countdown';
    // Adaptive/predictive opponents learn from the player's move.
    if ('observe' in this.opponent) {
      (this.opponent as { observe(m: Gesture): void }).observe(gesture);
    }
  }

  /** Resolve the round: choose computer move, apply rules, update scores. */
  shoot(): Round {
    if (this.phase !== 'countdown') {
      throw new Error(`Cannot shoot in phase "${this.phase}"`);
    }
    this.computerMove = this.opponent.move();
    const result = resolveRound(this.playerMove as Gesture, this.computerMove);
    if (!result) throw new Error('Unable to resolve round');

    this.roundNumber += 1;
    this.phase = 'revealed';
    const round: Round = {
      number: this.roundNumber,
      player: this.playerMove as Gesture,
      computer: this.computerMove,
      result,
      timestamp: Date.now(),
    };
    this.rounds.push(round);
    this.scores.record(result);
    return round;
  }

  /** Return to idle (call after the round result is displayed). */
  next(): void {
    this.playerMove = null;
    this.computerMove = null;
    this.phase = 'idle';
  }

  /** Full hard reset (rounds + scores). */
  reset(): void {
    this.rounds = [];
    this.roundNumber = 0;
    this.playerMove = null;
    this.computerMove = null;
    this.phase = 'idle';
    this.scores.resetPersisted();
  }

  get lastRound(): Round | null {
    return this.rounds[this.rounds.length - 1] ?? null;
  }
}
