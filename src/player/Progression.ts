/**
 * Progression.ts — pure XP/level math for the player profile system.
 * No storage access; unit-testable in Node.
 */

/** XP required to advance from level `level` to `level + 1`. */
export function xpForNextLevel(level: number): number {
  // Base 100, growing by 40 per level: 100, 140, 180, ...
  return 100 + (level - 1) * 40;
}

export function levelFromXp(totalXp: number): number {
  let level = 1;
  let remaining = totalXp;
  while (remaining >= xpForNextLevel(level)) {
    remaining -= xpForNextLevel(level);
    level += 1;
  }
  return level;
}

/** Progress (0–1) toward the next level for a given total XP. */
export function levelProgress(totalXp: number): number {
  const level = levelFromXp(totalXp);
  let consumed = 0;
  for (let l = 1; l < level; l += 1) {
    consumed += xpForNextLevel(l);
  }
  const intoLevel = totalXp - consumed;
  return Math.min(1, intoLevel / xpForNextLevel(level));
}

/** Titles unlocked by level. */
export function titleForLevel(level: number): string {
  if (level >= 20) return 'Grandmaster';
  if (level >= 15) return 'Master';
  if (level >= 10) return 'Veteran';
  if (level >= 5) return 'Contender';
  return 'Rookie';
}

export interface XpEvent {
  reason: string;
  xp: number;
}

/** Standard reward table (documented, transparent). */
export const XP_REWARDS: Record<string, number> = {
  'match:complete': 50,
  'round:win': 10,
  'round:lose': 3,
  'round:draw': 5,
  'bestof3:win': 60,
  'bestof5:win': 80,
  'survival:round10': 100,
  'daily:complete': 120,
  'achievement': 0, // replaced by achievement.rewardXp at runtime
};
