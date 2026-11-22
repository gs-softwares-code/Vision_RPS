/**
 * GestureStabilizer.ts — temporal smoothing and gesture locking.
 *
 * Prevents accidental round triggers: a gesture must persist for N
 * consecutive frames to be considered "stable", a lock freezes it for
 * the round, and a cooldown suppresses re-triggering for a short window
 * after a completed round. Pure state machine (injectable clock for tests).
 */

import type { Gesture } from './GestureClassifier';

export type StabilizerPhase = 'building' | 'stable' | 'idle' | 'cooldown';

export interface PushResult {
  phase: StabilizerPhase;
  gesture?: Gesture;
  streak?: number;
  remaining?: number;
}

export interface StabilizerOptions {
  requiredFrames?: number;
  minConfidence?: number;
  cooldownMs?: number;
  now?: () => number;
}

export class GestureStabilizer {
  requiredFrames: number;
  minConfidence: number;
  cooldownMs: number;
  private _now: () => number;

  gesture: Gesture | null = null;
  streak = 0;
  private _ready = false;
  locked: Gesture | null = null;
  private cooldownUntil = 0;

  constructor(options: StabilizerOptions = {}) {
    this.requiredFrames = options.requiredFrames ?? 3;
    this.minConfidence = options.minConfidence ?? 0.55;
    this.cooldownMs = options.cooldownMs ?? 1500;
    this._now = options.now ?? (() => Date.now());

    this.reset();
  }

  reset(): void {
    this.gesture = null;
    this.streak = 0;
    this._ready = false;
    this.locked = null;
    this.cooldownUntil = 0;
  }

  /** Feed one frame classification result. Returns an update descriptor. */
  push({ gesture, confidence }: { gesture: Gesture | null; confidence: number }): PushResult {
    const now = this._now();

    if (this.cooldownUntil > now) {
      return { phase: 'cooldown', remaining: this.cooldownUntil - now };
    }

    if (!gesture || confidence < this.minConfidence) {
      this.gesture = null;
      this.streak = 0;
      this._ready = false;
      return { phase: 'idle' };
    }

    if (gesture === this.gesture) {
      this.streak += 1;
    } else {
      this.gesture = gesture;
      this.streak = 1;
    }

    if (this.streak >= this.requiredFrames) {
      this._ready = true;
      return { phase: 'stable', gesture };
    }

    return { phase: 'building', gesture, streak: this.streak };
  }

  /** Lock the currently stable gesture and start the cooldown. */
  confirm(): Gesture | null {
    if (!this._ready || !this.gesture) return null;
    const gesture = this.gesture;
    this.locked = gesture;
    this._ready = false;
    this.gesture = null;
    this.streak = 0;
    this.cooldownUntil = this._now() + this.cooldownMs;
    return gesture;
  }

  get isStable(): boolean {
    return this._ready;
  }

  get inCooldown(): boolean {
    return this.cooldownUntil > this._now();
  }
}
