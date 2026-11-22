import { describe, it, expect } from 'vitest';
import { evaluateProgress, newlyUnlocked } from '../src/player/Achievements';
import { SEED_ACHIEVEMENTS, type AchievementDef } from '../src/storage/db';
import type { AchievementContext } from '../src/player/Achievements';

function ctx(partial: Partial<AchievementContext> = {}): AchievementContext {
  return {
    stats: {
      wins: 0,
      losses: 0,
      draws: 0,
      total: 0,
      winPercentage: 0,
      favoriteMove: null,
      mostSuccessfulMove: null,
      currentWinStreak: 0,
      bestWinStreak: 0,
    },
    matches: {
      totalMatches: 0,
      totalRounds: 0,
      wins: 0,
      losses: 0,
      draws: 0,
      winPercentage: 0,
      avgMatchDurationMs: 0,
      avgRoundsPerMatch: 0,
      modeDistribution: {},
    },
    trainingComplete: false,
    dailyComplete: false,
    playerId: 'p',
    ...partial,
  };
}

const def = (id: string): AchievementDef => SEED_ACHIEVEMENTS.find((a) => a.id === id)!;

describe('evaluateProgress', () => {
  it('first-match unlocks after one match', () => {
    expect(evaluateProgress(def('first-match'), ctx())).toBe(0);
    expect(evaluateProgress(def('first-match'), ctx({ matches: { ...ctx().matches, totalMatches: 1 } }))).toBe(1);
  });

  it('ten-victories reaches 0.5 at five wins', () => {
    const c = ctx({ matches: { ...ctx().matches, wins: 5 } });
    expect(evaluateProgress(def('ten-victories'), c)).toBe(0.5);
  });

  it('streak-5 uses best streak', () => {
    const c = ctx({ stats: { ...ctx().stats, bestWinStreak: 4 } });
    expect(evaluateProgress(def('streak-5'), c)).toBe(0.8);
    expect(evaluateProgress(def('streak-5'), ctx({ stats: { ...ctx().stats, bestWinStreak: 6 } }))).toBe(1);
  });

  it('training and daily are boolean gates', () => {
    expect(evaluateProgress(def('training-master'), ctx())).toBe(0);
    expect(evaluateProgress(def('training-master'), ctx({ trainingComplete: true }))).toBe(1);
    expect(evaluateProgress(def('daily-complete'), ctx({ dailyComplete: true }))).toBe(1);
  });
});

describe('newlyUnlocked', () => {
  it('only returns achievements crossing the threshold', () => {
    const defs = [def('first-match'), def('ten-victories'), def('training-master')];
    const existing = new Map();
    const unlocked = newlyUnlocked(defs, existing, ctx({ matches: { ...ctx().matches, totalMatches: 1 }, trainingComplete: true }));
    const ids = unlocked.map((a) => a.id);
    expect(ids).toContain('first-match');
    expect(ids).toContain('training-master');
    expect(ids).not.toContain('ten-victories');
  });

  it('does not re-report already unlocked achievements', () => {
    const defs = [def('first-match')];
    const existing = new Map([
      ['first-match', {
        id: 'p:first-match',
        playerId: 'p',
        achievementId: 'first-match',
        unlockedAt: 'x',
        progress: 1,
        target: 1,
        unlocked: true,
      }],
    ]);
    expect(newlyUnlocked(defs, existing, ctx({ matches: { ...ctx().matches, totalMatches: 5 } }))).toHaveLength(0);
  });
});
