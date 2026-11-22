/**
 * Statistics.ts — pure aggregation over match/round records.
 * Unit-testable; no I/O.
 */

import type { RoundResult } from '../game/ScoreManager';
import type { Gesture } from '../vision/GestureClassifier';
import type { MatchRecord, RoundRecord } from '../storage/db';

export interface RoundStats {
  wins: number;
  losses: number;
  draws: number;
  total: number;
  winPercentage: number;
  favoriteMove: Gesture | null;
  mostSuccessfulMove: Gesture | null;
  currentWinStreak: number;
  bestWinStreak: number;
}

export function computeRoundStats(rounds: RoundRecord[]): RoundStats {
  let wins = 0;
  let losses = 0;
  let draws = 0;

  const moveWinCount = new Map<Gesture, number>();
  const moveTotal = new Map<Gesture, number>();

  let bestStreak = 0;
  let currentStreak = 0;

  // rounds are assumed newest-first from the repository; walk oldest-first.
  const byTime = [...rounds].sort((a, b) => a.timestamp.localeCompare(b.timestamp));

  for (const r of byTime) {
    if (r.result === 'win') {
      wins += 1;
      currentStreak += 1;
      bestStreak = Math.max(bestStreak, currentStreak);
    } else if (r.result === 'lose') {
      losses += 1;
      currentStreak = 0;
    } else {
      draws += 1;
    }

    moveTotal.set(r.playerMove, (moveTotal.get(r.playerMove) ?? 0) + 1);
    if (r.result === 'win') {
      moveWinCount.set(r.playerMove, (moveWinCount.get(r.playerMove) ?? 0) + 1);
    }
  }

  const total = rounds.length;
  const winPercentage = total ? Math.round((wins / total) * 1000) / 10 : 0;

  const favoriteMove: Gesture | null =
    [...moveTotal.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

  let mostSuccessfulMove: Gesture | null = null;
  let bestRate = -1;
  for (const [move, played] of moveTotal) {
    const rate = (moveWinCount.get(move) ?? 0) / played;
    if (rate > bestRate) {
      bestRate = rate;
      mostSuccessfulMove = move;
    }
  }

  return {
    wins,
    losses,
    draws,
    total,
    winPercentage,
    favoriteMove,
    mostSuccessfulMove,
    currentWinStreak: currentStreak,
    bestWinStreak: bestStreak,
  };
}

export interface MatchAggregate {
  totalMatches: number;
  totalRounds: number;
  wins: number;
  losses: number;
  draws: number;
  winPercentage: number;
  avgMatchDurationMs: number;
  avgRoundsPerMatch: number;
  modeDistribution: Record<string, number>;
}

export function aggregateMatches(matches: MatchRecord[]): MatchAggregate {
  const total = matches.length;
  let wins = 0;
  let losses = 0;
  let draws = 0;
  let rounds = 0;
  let durationMs = 0;
  const modeDistribution: Record<string, number> = {};

  for (const m of matches) {
    rounds += m.roundsPlayed;
    durationMs += m.durationMs;
    if (m.result === 'win') wins += 1;
    else if (m.result === 'lose') losses += 1;
    else if (m.result === 'draw') draws += 1;
    modeDistribution[m.mode] = (modeDistribution[m.mode] ?? 0) + 1;
  }

  return {
    totalMatches: total,
    totalRounds: rounds,
    wins,
    losses,
    draws,
    winPercentage: total ? Math.round((wins / total) * 1000) / 10 : 0,
    avgMatchDurationMs: total ? Math.round(durationMs / total) : 0,
    avgRoundsPerMatch: total ? Math.round((rounds / total) * 10) / 10 : 0,
    modeDistribution,
  };
}

export type RoundResultFilter = RoundResult | 'all';

export function filterRounds(rounds: RoundRecord[], opts: {
  result?: RoundResultFilter;
  from?: string;
  to?: string;
}): RoundRecord[] {
  return rounds.filter((r) => {
    if (opts.result && opts.result !== 'all' && r.result !== opts.result) return false;
    if (opts.from && r.timestamp < opts.from) return false;
    if (opts.to && r.timestamp > opts.to) return false;
    return true;
  });
}
