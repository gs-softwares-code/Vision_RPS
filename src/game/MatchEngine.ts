/**
 * MatchEngine.ts — match-level state machine + game modes.
 *
 * Wraps a GameEngine and adds:
 *  - an explicit MatchState machine (IDLE → COUNTDOWN → LOCKED → RESOLVING →
 *    ROUND_COMPLETE → WAITING / MATCH_COMPLETE)
 *  - game modes (classic, bestOf3, bestOf5, practice, speed, survival, daily)
 *  - match scoring / completion rules
 *  - guards against multiple rounds triggering from one gesture
 *
 * The computer's move is still chosen only after the player's gesture is
 * locked (inside shoot()), preserving fairness.
 */

import { GameEngine, type Round } from './GameEngine';
import { GESTURES, type Gesture } from '../vision/GestureClassifier';
import type { GameMode } from '../storage/db';
import type { ComputerOpponent } from './ComputerOpponent';

export type MatchState =
  | 'IDLE'
  | 'INITIALIZING'
  | 'WAITING_FOR_GESTURE'
  | 'COUNTDOWN'
  | 'MOVE_LOCKED'
  | 'RESOLVING'
  | 'ROUND_COMPLETE'
  | 'MATCH_COMPLETE';

export interface MatchConfig {
  mode: GameMode;
  roundsToWin?: number; // best-of-N
  timeLimitMs?: number; // speed mode
  opponent?: ComputerOpponent;
}

export interface MatchOutcome {
  state: MatchState;
  roundsPlayed: number;
  wins: number;
  losses: number;
  draws: number;
  complete: boolean;
  playerWonMatch: boolean;
}

export class MatchEngine {
  mode: GameMode;
  roundsToWin: number;
  timeLimitMs: number | null;
  game: GameEngine;

  state: MatchState = 'IDLE';
  private _roundActive = false;
  private _startedAt = 0;

  constructor(config: MatchConfig) {
    this.mode = config.mode;
    this.game = new GameEngine({ opponent: config.opponent });
    this.roundsToWin = config.roundsToWin ?? 2;
    this.timeLimitMs = config.timeLimitMs ?? null;
  }

  get validGesture(): boolean {
    return this.state === 'WAITING_FOR_GESTURE' || this.state === 'IDLE';
  }

  get canLock(): boolean {
    return !this._roundActive && (this.state === 'WAITING_FOR_GESTURE' || this.state === 'IDLE');
  }

  start(): void {
    this.state = 'INITIALIZING';
    this._startedAt = Date.now();
    this.state = 'WAITING_FOR_GESTURE';
  }

  /** Lock a detected, stabilized gesture → begin countdown. */
  lock(gesture: Gesture): void {
    if (!this.canLock) {
      throw new Error(`Cannot lock in state "${this.state}"`);
    }
    this._roundActive = true;
    this.state = 'COUNTDOWN';
    this.game.lock(gesture);
    this.state = 'MOVE_LOCKED';
  }

  /** Resolve the locked round (after countdown). Returns the round. */
  shoot(): Round {
    if (this.state !== 'MOVE_LOCKED') {
      throw new Error(`Cannot shoot in state "${this.state}"`);
    }
    this.state = 'RESOLVING';
    const round = this.game.shoot();
    // Speed mode: enforce time limit.
    if (this.mode === 'speed' && this.timeLimitMs && Date.now() - this._startedAt > this.timeLimitMs) {
      this.state = 'MATCH_COMPLETE';
      return round;
    }
    this.state = 'ROUND_COMPLETE';
    return round;
  }

  /** Call after the round UI has settled; advances to next state. */
  next(): MatchOutcome {
    if (this.mode === 'classic' || this.mode === 'practice') {
      this._roundActive = false;
      this.game.next();
      this.state = 'WAITING_FOR_GESTURE';
      return this.outcome();
    }
    if (this.mode === 'survival') {
      if (this.game.scores.snapshot().computerWins >= 1) {
        this._endMatch();
        return this.outcome();
      }
      this._roundActive = false;
      this.game.next();
      this.state = 'WAITING_FOR_GESTURE';
      return this.outcome();
    }
    // best-of-N / daily
    const snap = this.game.scores.snapshot();
    const needed = this.mode === 'bestOf5' ? 3 : this.roundsToWin;
    if (snap.playerWins >= needed || snap.computerWins >= needed) {
      this._endMatch();
    } else {
      this._roundActive = false;
      this.game.next();
      this.state = 'WAITING_FOR_GESTURE';
    }
    return this.outcome();
  }

  private _endMatch(): void {
    this.state = 'MATCH_COMPLETE';
    this._roundActive = false;
  }

  outcome(): MatchOutcome {
    const snap = this.game.scores.snapshot();
    const complete = this.state === 'MATCH_COMPLETE';
    const needed = this.mode === 'bestOf5' ? 3 : this.roundsToWin;
    let playerWonMatch = false;
    if (complete) {
      playerWonMatch = snap.playerWins >= needed;
      if (this.mode === 'survival') playerWonMatch = snap.computerWins === 0;
    }
    return {
      state: this.state,
      roundsPlayed: snap.totalRounds,
      wins: snap.playerWins,
      losses: snap.computerWins,
      draws: snap.draws,
      complete,
      playerWonMatch,
    };
  }

  get lastRound(): Round | null {
    return this.game.lastRound;
  }

  /** Revert to idle / reset (e.g. restart match). */
  reset(): void {
    this.game.reset();
    this._roundActive = false;
    this.state = 'IDLE';
  }
}

// Small helper: valid moves for UI.
export { GESTURES };
