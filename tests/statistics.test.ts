import { describe, it, expect } from 'vitest';
import { computeRoundStats, aggregateMatches, filterRounds } from '../src/player/Statistics';
import type { RoundRecord, MatchRecord } from '../src/storage/db';

function round(partial: Partial<RoundRecord>): RoundRecord {
  return {
    id: partial.id ?? '',
    matchId: partial.matchId ?? 'm',
    playerId: partial.playerId ?? 'p',
    playerMove: partial.playerMove ?? 'rock',
    computerMove: partial.computerMove ?? 'scissors',
    result: partial.result ?? 'win',
    gestureConfidence: partial.gestureConfidence ?? null,
    detectionDurationMs: partial.detectionDurationMs ?? null,
    timestamp: partial.timestamp ?? '2026-01-01T00:00:00.000Z',
  };
}

describe('computeRoundStats', () => {
  it('computes win/loss/draw and win percentage', () => {
    const rounds = [
      round({ result: 'win' }),
      round({ result: 'lose' }),
      round({ result: 'draw' }),
      round({ result: 'win' }),
    ];
    const s = computeRoundStats(rounds);
    expect(s.wins).toBe(2);
    expect(s.losses).toBe(1);
    expect(s.draws).toBe(1);
    expect(s.total).toBe(4);
    expect(s.winPercentage).toBe(50);
  });

  it('tracks best win streak across consecutive wins', () => {
    const rounds = [
      round({ result: 'win', timestamp: '1' }),
      round({ result: 'win', timestamp: '2' }),
      round({ result: 'lose', timestamp: '3' }),
      round({ result: 'win', timestamp: '4' }),
      round({ result: 'win', timestamp: '5' }),
      round({ result: 'win', timestamp: '6' }),
    ];
    const s = computeRoundStats(rounds);
    expect(s.bestWinStreak).toBe(3);
    expect(s.currentWinStreak).toBe(3);
  });

  it('resets current streak on a loss', () => {
    const rounds = [
      round({ result: 'win', timestamp: '1' }),
      round({ result: 'win', timestamp: '2' }),
      round({ result: 'lose', timestamp: '3' }),
    ];
    const s = computeRoundStats(rounds);
    expect(s.currentWinStreak).toBe(0);
    expect(s.bestWinStreak).toBe(2);
  });

  it('identifies favorite and most successful move', () => {
    const rounds = [
      round({ playerMove: 'rock', result: 'win' }),
      round({ playerMove: 'rock', result: 'lose' }),
      round({ playerMove: 'paper', result: 'win' }),
    ];
    const s = computeRoundStats(rounds);
    expect(s.favoriteMove).toBe('rock');
    expect(s.mostSuccessfulMove).toBe('paper');
  });

  it('handles empty input', () => {
    const s = computeRoundStats([]);
    expect(s.total).toBe(0);
    expect(s.winPercentage).toBe(0);
    expect(s.favoriteMove).toBeNull();
    expect(s.mostSuccessfulMove).toBeNull();
  });
});

describe('aggregateMatches', () => {
  const match = (partial: Partial<MatchRecord> = {}): MatchRecord => ({
    id: partial.id ?? '',
    playerId: partial.playerId ?? 'p',
    mode: partial.mode ?? 'classic',
    startedAt: partial.startedAt ?? '2026-01-01T00:00:00.000Z',
    completedAt: partial.completedAt ?? '2026-01-01T00:01:00.000Z',
    roundsPlayed: partial.roundsPlayed ?? 1,
    wins: partial.wins ?? 1,
    losses: partial.losses ?? 0,
    draws: partial.draws ?? 0,
    result: partial.result ?? 'win',
    durationMs: partial.durationMs ?? 60_000,
  });

  it('aggregates totals and win percentage', () => {
    const a = aggregateMatches([
      match({ result: 'win' }),
      match({ result: 'lose' }),
      match({ result: 'draw' }),
    ]);
    expect(a.totalMatches).toBe(3);
    expect(a.wins).toBe(1);
    expect(a.losses).toBe(1);
    expect(a.draws).toBe(1);
    expect(a.winPercentage).toBeCloseTo(33.3, 1);
  });

  it('computes averages and mode distribution', () => {
    const a = aggregateMatches([
      match({ mode: 'classic', roundsPlayed: 3, durationMs: 90_000 }),
      match({ mode: 'bestOf3', roundsPlayed: 2, durationMs: 60_000 }),
    ]);
    expect(a.avgRoundsPerMatch).toBe(2.5);
    expect(a.avgMatchDurationMs).toBe(75_000);
    expect(a.modeDistribution.classic).toBe(1);
    expect(a.modeDistribution.bestOf3).toBe(1);
  });
});

describe('filterRounds', () => {
  it('filters by result and date range', () => {
    const rounds = [
      round({ result: 'win', timestamp: '2026-01-01T00:00:00Z' }),
      round({ result: 'lose', timestamp: '2026-01-02T00:00:00Z' }),
      round({ result: 'win', timestamp: '2026-01-03T00:00:00Z' }),
    ];
    expect(filterRounds(rounds, { result: 'win' })).toHaveLength(2);
    expect(filterRounds(rounds, { from: '2026-01-02T00:00:00Z' })).toHaveLength(2);
    expect(filterRounds(rounds, { to: '2026-01-01T12:00:00Z' })).toHaveLength(1);
    expect(filterRounds(rounds, { result: 'all' })).toHaveLength(3);
  });
});
