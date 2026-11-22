/**
 * Achievements.ts — pure achievement evaluation (unit-testable) plus a
 * Dexie-backed unlock repository.
 *
 * Evaluators receive a snapshot of the player's current stats/events and
 * return a progress ratio (0–1); when ratio >= 1 the achievement unlocks.
 */

import { db, type AchievementDef, type PlayerAchievement } from '../storage/db';
import type { RoundStats, MatchAggregate } from './Statistics';

export interface AchievementContext {
  stats: RoundStats;
  matches: MatchAggregate;
  trainingComplete: boolean;
  dailyComplete: boolean;
  playerId: string;
}

export type Evaluator = (ctx: AchievementContext) => number;

const EVALUATORS: Record<string, Evaluator> = {
  'first-match': (c) => Math.min(1, c.matches.totalMatches / 1),
  'first-victory': (c) => Math.min(1, c.matches.wins / 1),
  'ten-victories': (c) => Math.min(1, c.matches.wins / 10),
  'fifty-matches': (c) => Math.min(1, c.matches.totalMatches / 50),
  'hundred-matches': (c) => Math.min(1, c.matches.totalMatches / 100),
  'streak-5': (c) => Math.min(1, c.stats.bestWinStreak / 5),
  'streak-10': (c) => Math.min(1, c.stats.bestWinStreak / 10),
  'perfect-bestof3': (c) => (c.matches.totalMatches ? 1 : 0), // set via dedicated event
  'perfect-bestof5': (c) => (c.matches.totalMatches ? 1 : 0),
  'training-master': (c) => (c.trainingComplete ? 1 : 0),
  'daily-complete': (c) => (c.dailyComplete ? 1 : 0),
  'survival-champion': (c) => (c.stats.total >= 10 ? Math.min(1, c.stats.total / 10) : 0),
};

/** Evaluate progress (0–1) for a single achievement. */
export function evaluateProgress(def: AchievementDef, ctx: AchievementContext): number {
  const fn = EVALUATORS[def.id];
  if (!fn) return 0;
  return Math.max(0, Math.min(1, fn(ctx)));
}

/** Return achievements that unlocked in this evaluation pass. */
export function newlyUnlocked(
  defs: AchievementDef[],
  existing: Map<string, PlayerAchievement>,
  ctx: AchievementContext,
): AchievementDef[] {
  return defs.filter((def) => {
    const prev = existing.get(def.id);
    if (prev?.unlocked) return false;
    return evaluateProgress(def, ctx) >= 1;
  });
}

export class AchievementRepository {
  async listDefs(): Promise<AchievementDef[]> {
    return db.achievements.toArray();
  }

  async listForPlayer(playerId: string): Promise<PlayerAchievement[]> {
    return db.playerAchievements.where('playerId').equals(playerId).toArray();
  }

  async stateMap(playerId: string): Promise<Map<string, PlayerAchievement>> {
    const rows = await this.listForPlayer(playerId);
    return new Map(rows.map((r) => [r.achievementId, r]));
  }

  async upsertProgress(playerId: string, defs: AchievementDef[], ctx: AchievementContext): Promise<AchievementDef[]> {
    const existing = await this.stateMap(playerId);
    const newly: AchievementDef[] = [];

    for (const def of defs) {
      const progress = evaluateProgress(def, ctx);
      const unlocked = progress >= 1;
      const prev = existing.get(def.id);
      if (prev) {
        const next = { ...prev, progress, unlocked };
        if (next.unlocked !== prev.unlocked) {
          next.unlockedAt = next.unlocked ? new Date().toISOString() : prev.unlockedAt;
          if (next.unlocked) newly.push(def);
        }
        if (next.progress !== prev.progress || next.unlocked !== prev.unlocked) {
          await db.playerAchievements.put(next);
        }
      } else {
        const row: PlayerAchievement = {
          id: `${playerId}:${def.id}`,
          playerId,
          achievementId: def.id,
          unlockedAt: unlocked ? new Date().toISOString() : '',
          progress,
          target: 1,
          unlocked,
        };
        await db.playerAchievements.put(row);
        if (unlocked) newly.push(def);
      }
    }

    return newly;
  }
}

export const achievementRepo = new AchievementRepository();
