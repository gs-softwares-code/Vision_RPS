/**
 * db.ts — Dexie (IndexedDB) schema, versioning and migrations.
 *
 * Tables:
 *   profiles            local player identities
 *   matches             completed gameplay sessions (owns rounds)
 *   rounds              individual rock/paper/scissors decisions
 *   achievements        the achievement catalog
 *   player_achievements unlock state + progress per profile
 *   progression         XP/level events (audit trail, dedup by event id)
 *   app_settings        non-critical preferences (JSON blobs)
 */

import Dexie, { type Table } from 'dexie';
import type { Gesture } from '../vision/GestureClassifier';
import type { RoundResult } from '../game/ScoreManager';

// ---- Data models -----------------------------------------------------------

export type GameMode =
  | 'classic'
  | 'bestOf3'
  | 'bestOf5'
  | 'practice'
  | 'speed'
  | 'survival'
  | 'daily';

export type AvatarId = string;

export interface Profile {
  id: string; // UUID
  username: string;
  avatar: AvatarId;
  createdAt: string; // ISO
  level: number;
  xp: number;
  matchesPlayed: number;
  roundsPlayed: number;
  wins: number;
  losses: number;
  draws: number;
  currentStreak: number;
  bestStreak: number;
  favoriteGesture: Gesture | null;
  preferredMode: GameMode;
}

export interface MatchRecord {
  id: string;
  playerId: string;
  mode: GameMode;
  startedAt: string;
  completedAt: string;
  roundsPlayed: number;
  wins: number;
  losses: number;
  draws: number;
  result: RoundResult | 'incomplete';
  durationMs: number;
}

export interface RoundRecord {
  id: string;
  matchId: string;
  playerId: string;
  playerMove: Gesture;
  computerMove: Gesture;
  result: RoundResult;
  gestureConfidence: number | null;
  detectionDurationMs: number | null;
  timestamp: string;
}

export interface AchievementDef {
  id: string;
  name: string;
  description: string;
  icon: string;
  rewardXp: number;
}

export interface PlayerAchievement {
  id: string; // `${playerId}:${achievementId}`
  playerId: string;
  achievementId: string;
  unlockedAt: string;
  progress: number;
  target: number;
  unlocked: boolean;
}

export interface ProgressionEvent {
  id: string; // `${playerId}:${eventKey}` for dedup
  playerId: string;
  xp: number;
  reason: string;
  at: string;
}

export interface AppSettingsRow {
  key: string;
  value: unknown;
  updatedAt: string;
}

// ---- Database ---------------------------------------------------------------

export class VisionRPSDatabase extends Dexie {
  profiles!: Table<Profile, string>;
  matches!: Table<MatchRecord, string>;
  rounds!: Table<RoundRecord, string>;
  achievements!: Table<AchievementDef, string>;
  playerAchievements!: Table<PlayerAchievement, string>;
  progression!: Table<ProgressionEvent, string>;
  appSettings!: Table<AppSettingsRow, string>;

  constructor() {
    super('vision-rps');

    this.version(1).stores({
      profiles: 'id, username, createdAt, level, xp',
      matches: 'id, playerId, mode, result, startedAt, completedAt, [playerId+startedAt]',
      rounds: 'id, matchId, playerId, result, timestamp, [playerId+timestamp]',
      achievements: 'id',
      playerAchievements: 'id, playerId, achievementId, unlocked, [playerId+unlocked]',
      progression: 'id, playerId, at',
      appSettings: 'key',
    });

    // Seed the achievement catalog on first open.
    this.on('populate', () => {
      return this.achievements.bulkAdd(SEED_ACHIEVEMENTS);
    });
  }
}

export const SEED_ACHIEVEMENTS: AchievementDef[] = [
  { id: 'first-match', name: 'First Match', description: 'Complete your first match.', icon: 'play', rewardXp: 25 },
  { id: 'first-victory', name: 'First Victory', description: 'Win your first match.', icon: 'trophy', rewardXp: 40 },
  { id: 'ten-victories', name: 'Ten Victories', description: 'Win 10 matches total.', icon: 'trophy', rewardXp: 120 },
  { id: 'fifty-matches', name: 'Fifty Matches', description: 'Play 50 matches.', icon: 'gamepad', rewardXp: 150 },
  { id: 'hundred-matches', name: 'Hundred Matches', description: 'Play 100 matches.', icon: 'gamepad', rewardXp: 300 },
  { id: 'streak-5', name: 'On Fire', description: 'Win 5 matches in a row.', icon: 'flame', rewardXp: 100 },
  { id: 'streak-10', name: 'Unstoppable', description: 'Win 10 matches in a row.', icon: 'flame', rewardXp: 250 },
  { id: 'perfect-bestof3', name: 'Clean Sweep', description: 'Win a Best-of-3 without losing a round.', icon: 'star', rewardXp: 80 },
  { id: 'perfect-bestof5', name: 'Flawless', description: 'Win a Best-of-5 without losing a round.', icon: 'star', rewardXp: 140 },
  { id: 'training-master', name: 'Training Master', description: 'Complete all three training exercises.', icon: 'dumbbell', rewardXp: 60 },
  { id: 'daily-complete', name: 'Daily Challenger', description: 'Complete the daily challenge.', icon: 'calendar', rewardXp: 90 },
  { id: 'survival-champion', name: 'Survival Champion', description: 'Survive 10 rounds in Survival mode.', icon: 'shield', rewardXp: 160 },
];

export const db = new VisionRPSDatabase();
