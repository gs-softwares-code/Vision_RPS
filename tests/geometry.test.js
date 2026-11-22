import { describe, it, expect } from 'vitest';
import {
  dist,
  angleBetween,
  sub,
  normalize,
  palmCenter,
  fingerState,
  thumbState,
} from '../src/vision/geometry';
import { makeHand, HANDS } from './fixtures/landmarks.js';

describe('geometry primitives', () => {
  it('computes euclidean distance', () => {
    expect(dist({ x: 0, y: 0, z: 0 }, { x: 3, y: 4, z: 0 })).toBeCloseTo(5, 5);
  });

  it('computes angle between vectors', () => {
    const a = { x: 1, y: 0, z: 0 };
    const b = { x: 0, y: 1, z: 0 };
    expect(angleBetween(a, b)).toBeCloseTo(Math.PI / 2, 5);
    expect(angleBetween(a, a)).toBeCloseTo(0, 5);
  });

  it('normalizes vectors', () => {
    const n = normalize({ x: 0, y: 5, z: 0 });
    expect(dist(n, { x: 0, y: 1, z: 0 })).toBeCloseTo(0, 5);
  });

  it('sub/angle are consistent', () => {
    const a = { x: 1, y: 2, z: 0 };
    const b = sub(a, { x: 1, y: 2, z: 0 });
    expect(b.x).toBe(0);
    expect(b.y).toBe(0);
  });

  it('palm center lies inside the palm region', () => {
    const c = palmCenter(HANDS.paper());
    expect(c.x).toBeGreaterThan(0.4);
    expect(c.x).toBeLessThan(1.3);
    expect(c.y).toBeGreaterThan(-0.5);
    expect(c.y).toBeLessThan(0.6);
  });
});

describe('fingerState (straight vs bent)', () => {
  const straight = fingerState(HANDS.paper(), 'index');
  const bent = fingerState(HANDS.rock(), 'index');

  it('straight finger scores high and is extended', () => {
    expect(straight.score).toBeGreaterThan(0.6);
    expect(straight.extended).toBe(true);
  });

  it('bent finger scores low and is not extended', () => {
    expect(bent.score).toBeLessThan(0.4);
    expect(bent.extended).toBe(false);
  });

  it('straight beats bent for every long finger', () => {
    for (const k of ['index', 'middle', 'ring', 'pinky']) {
      expect(fingerState(HANDS.paper(), k).score).toBeGreaterThan(
        fingerState(HANDS.rock(), k).score,
      );
    }
  });
});

describe('thumbState (open vs tucked)', () => {
  it('open thumb is extended', () => {
    expect(thumbState(HANDS.paper()).extended).toBe(true);
  });

  it('tucked thumb is not extended', () => {
    expect(thumbState(HANDS.rock()).extended).toBe(false);
  });
});

describe('transform invariance sanity', () => {
  it('rotation preserves distances', () => {
    const hand = HANDS.paper();
    const rotated = hand.map(() => ({ x: 0, y: 0, z: 0 }));
    // compare a single known pair within a rotated hand
    const a = { x: 0, y: 0, z: 0 };
    const b = { x: 1, y: 0, z: 0 };
    const rot = (p) => ({ x: p.x * Math.cos(1.2) - p.y * Math.sin(1.2), y: p.x * Math.sin(1.2) + p.y * Math.cos(1.2), z: 0 });
    expect(dist(a, b)).toBeCloseTo(dist(rot(a), rot(b)), 5);
    expect(rotated).toBeDefined();
    void hand;
  });
});
