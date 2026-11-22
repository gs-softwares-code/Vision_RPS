import { describe, it, expect } from 'vitest';
import { xpForNextLevel, levelFromXp, levelProgress, titleForLevel } from '../src/player/Progression';

describe('Progression', () => {
  it('xpForNextLevel grows by 40 per level', () => {
    expect(xpForNextLevel(1)).toBe(100);
    expect(xpForNextLevel(2)).toBe(140);
    expect(xpForNextLevel(3)).toBe(180);
  });

  it('levelFromXp starts at level 1', () => {
    expect(levelFromXp(0)).toBe(1);
    expect(levelFromXp(99)).toBe(1);
  });

  it('levelFromXp crosses thresholds', () => {
    expect(levelFromXp(100)).toBe(2);
    expect(levelFromXp(240)).toBe(3); // 100 + 140
    expect(levelFromXp(420)).toBe(4); // 100 + 140 + 180
  });

  it('levelProgress is in [0,1] and monotonic', () => {
    expect(levelProgress(0)).toBeCloseTo(0, 5);
    expect(levelProgress(50)).toBeGreaterThan(0);
    expect(levelProgress(100)).toBeCloseTo(0, 5); // exactly at next level
    expect(levelProgress(150)).toBeGreaterThan(0);
  });

  it('titleForLevel tiers', () => {
    expect(titleForLevel(1)).toBe('Rookie');
    expect(titleForLevel(6)).toBe('Contender');
    expect(titleForLevel(12)).toBe('Veteran');
    expect(titleForLevel(16)).toBe('Master');
    expect(titleForLevel(25)).toBe('Grandmaster');
  });
});
