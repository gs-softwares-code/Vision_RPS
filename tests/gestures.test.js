import { describe, it, expect } from 'vitest';
import { classify, GESTURES } from '../src/vision/GestureClassifier';
import { GestureStabilizer } from '../src/vision/GestureStabilizer';
import { HANDS, transformHand } from './fixtures/landmarks.js';

describe('classify — canonical gestures', () => {
  it('recognizes paper (open palm)', () => {
    const r = classify(HANDS.paper(), 'Right');
    expect(r.gesture).toBe(GESTURES.PAPER);
    expect(r.confidence).toBeGreaterThan(0.55);
  });

  it('recognizes rock (closed fist)', () => {
    const r = classify(HANDS.rock(), 'Right');
    expect(r.gesture).toBe(GESTURES.ROCK);
    expect(r.confidence).toBeGreaterThan(0.55);
  });

  it('recognizes scissors (index + middle extended)', () => {
    const r = classify(HANDS.scissors(), 'Right');
    expect(r.gesture).toBe(GESTURES.SCISSORS);
    expect(r.confidence).toBeGreaterThan(0.55);
  });
});

describe('classify — rejection of invalid gestures', () => {
  it('rejects a partial hand (only middle extended)', () => {
    const r = classify(HANDS.partial(), 'Right');
    expect(r.gesture).toBe(GESTURES.UNKNOWN);
  });

  it('rejects an invalid two-finger combo (index + ring)', () => {
    const r = classify(HANDS.invalidTwo(), 'Right');
    expect(r.gesture).toBe(GESTURES.UNKNOWN);
  });

  it('rejects a fist with the thumb sticking out', () => {
    const r = classify(HANDS.fistWithThumbOut(), 'Right');
    expect(r.gesture).toBe(GESTURES.UNKNOWN);
  });

  it('returns unknown for malformed input', () => {
    expect(classify(null).gesture).toBe(GESTURES.UNKNOWN);
    expect(classify([]).gesture).toBe(GESTURES.UNKNOWN);
    expect(classify(new Array(10).fill({ x: 0, y: 0, z: 0 })).gesture).toBe(GESTURES.UNKNOWN);
  });
});

describe('classify — rotation invariance', () => {
  const angles = [0, Math.PI / 4, Math.PI / 2, -1.2, Math.PI];

  it('paper is rotation invariant', () => {
    for (const a of angles) {
      const rotated = transformHand(HANDS.paper(), { rotate: a });
      expect(classify(rotated, 'Right').gesture).toBe(GESTURES.PAPER);
    }
  });

  it('rock is rotation invariant', () => {
    for (const a of angles) {
      const rotated = transformHand(HANDS.rock(), { rotate: a });
      expect(classify(rotated, 'Right').gesture).toBe(GESTURES.ROCK);
    }
  });

  it('scissors is rotation invariant', () => {
    for (const a of angles) {
      const rotated = transformHand(HANDS.scissors(), { rotate: a });
      expect(classify(rotated, 'Right').gesture).toBe(GESTURES.SCISSORS);
    }
  });
});

describe('classify — handedness passthrough', () => {
  it('carries handedness through', () => {
    const r = classify(HANDS.paper(), 'Left');
    expect(r.handedness).toBe('Left');
  });
});

describe('GestureStabilizer', () => {
  const now = () => 1000;
  const makeStab = (overrides = {}) => new GestureStabilizer({ now, requiredFrames: 3, cooldownMs: 1500, ...overrides });

  it('requires consecutive frames to become stable', () => {
    const s = makeStab();
    expect(s.push({ gesture: 'rock', confidence: 0.9 }).phase).toBe('building');
    expect(s.push({ gesture: 'rock', confidence: 0.9 }).phase).toBe('building');
    const stable = s.push({ gesture: 'rock', confidence: 0.9 });
    expect(stable.phase).toBe('stable');
    expect(stable.gesture).toBe('rock');
  });

  it('resets the streak when the gesture changes', () => {
    const s = makeStab();
    s.push({ gesture: 'rock', confidence: 0.9 });
    s.push({ gesture: 'rock', confidence: 0.9 });
    s.push({ gesture: 'paper', confidence: 0.9 });
    expect(s.push({ gesture: 'paper', confidence: 0.9 }).phase).toBe('building');
  });

  it('ignores low-confidence frames', () => {
    const s = makeStab();
    expect(s.push({ gesture: 'rock', confidence: 0.2 }).phase).toBe('idle');
    expect(s.push({ gesture: null, confidence: 0.9 }).phase).toBe('idle');
  });

  it('confirm() locks the stable gesture and starts cooldown', () => {
    const s = makeStab();
    s.push({ gesture: 'scissors', confidence: 0.9 });
    s.push({ gesture: 'scissors', confidence: 0.9 });
    s.push({ gesture: 'scissors', confidence: 0.9 });
    expect(s.confirm()).toBe('scissors');
    expect(s.locked).toBe('scissors');
    expect(s.inCooldown).toBe(true);
  });

  it('blocks refeed during cooldown', () => {
    const s = makeStab();
    s.push({ gesture: 'paper', confidence: 0.9 });
    s.push({ gesture: 'paper', confidence: 0.9 });
    s.push({ gesture: 'paper', confidence: 0.9 });
    s.confirm();
    expect(s.push({ gesture: 'paper', confidence: 0.9 }).phase).toBe('cooldown');
  });

  it('cannot confirm when nothing is stable', () => {
    const s = makeStab();
    expect(s.confirm()).toBeNull();
  });
});
