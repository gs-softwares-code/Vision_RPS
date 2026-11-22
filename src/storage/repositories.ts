/**
 * repositories.ts — typed CRUD over the Dexie database for the domain
 * aggregates (profiles, matches, rounds, progression, achievements).
 * Pure computation (stats, streaks, XP, achievement evaluation) lives in
 * separate modules so it can be unit-tested without IndexedDB.
 */

import { db, type Profile, type MatchRecord, type RoundRecord, type ProgressionEvent } from './db';

export interface ProfileInput {
  username: string;
  avatar?: string;
  preferredMode?: Profile['preferredMode'];
}

export class ProfileRepository {
  async create(input: ProfileInput): Promise<Profile> {
    const now = new Date().toISOString();
    const profile: Profile = {
      id: crypto.randomUUID(),
      username: input.username.trim(),
      avatar: input.avatar ?? 'default',
      createdAt: now,
      level: 1,
      xp: 0,
      matchesPlayed: 0,
      roundsPlayed: 0,
      wins: 0,
      losses: 0,
      draws: 0,
      currentStreak: 0,
      bestStreak: 0,
      favoriteGesture: null,
      preferredMode: input.preferredMode ?? 'classic',
    };
    await db.profiles.add(profile);
    return profile;
  }

  async list(): Promise<Profile[]> {
    return db.profiles.orderBy('createdAt').reverse().toArray();
  }

  async get(id: string): Promise<Profile | undefined> {
    return db.profiles.get(id);
  }

  async update(id: string, patch: Partial<Profile>): Promise<void> {
    await db.profiles.update(id, patch);
  }

  async delete(id: string): Promise<void> {
    // Cascade: remove owned matches/rounds/progression/achievements.
    await db.transaction('rw', db.profiles, db.matches, db.rounds, db.progression, db.playerAchievements, async () => {
      const matches = await db.matches.where('playerId').equals(id).toArray();
      const matchIds = matches.map((m) => m.id);
      await db.rounds.where('playerId').equals(id).delete();
      if (matchIds.length) await db.matches.bulkDelete(matchIds);
      await db.progression.where('playerId').equals(id).delete();
      await db.playerAchievements.where('playerId').equals(id).delete();
      await db.profiles.delete(id);
    });
  }
}

export class MatchRepository {
  async create(match: Omit<MatchRecord, 'id'>): Promise<MatchRecord> {
    const record: MatchRecord = { ...match, id: crypto.randomUUID() };
    await db.matches.add(record);
    return record;
  }

  async addRound(matchId: string, round: Omit<RoundRecord, 'id' | 'matchId'> & { playerId: string }): Promise<RoundRecord> {
    const record: RoundRecord = { ...round, id: crypto.randomUUID(), matchId };
    await db.rounds.add(record);
    return record;
  }

  async listForPlayer(playerId: string, limit = 100): Promise<MatchRecord[]> {
    return db.matches
      .where('playerId')
      .equals(playerId)
      .reverse()
      .limit(limit)
      .toArray();
  }

  async roundsForMatch(matchId: string): Promise<RoundRecord[]> {
    return db.rounds.where('matchId').equals(matchId).sortBy('timestamp');
  }

  async roundsForPlayer(playerId: string, limit = 500): Promise<RoundRecord[]> {
    return db.rounds.where('playerId').equals(playerId).reverse().limit(limit).toArray();
  }

  async deleteMatch(matchId: string): Promise<void> {
    await db.transaction('rw', db.matches, db.rounds, async () => {
      await db.rounds.where('matchId').equals(matchId).delete();
      await db.matches.delete(matchId);
    });
  }

  async clearPlayerHistory(playerId: string): Promise<void> {
    await db.transaction('rw', db.matches, db.rounds, async () => {
      const matches = await db.matches.where('playerId').equals(playerId).toArray();
      await db.rounds.where('playerId').equals(playerId).delete();
      if (matches.length) await db.matches.bulkDelete(matches.map((m) => m.id));
    });
  }
}

export class ProgressionRepository {
  async addEvent(event: Omit<ProgressionEvent, 'id'>): Promise<boolean> {
    // Dedup by event key to prevent double-award XP.
    const id = `${event.playerId}:${event.reason}`;
    const existing = await db.progression.get(id);
    if (existing) return false;
    await db.progression.add({ ...event, id });
    return true;
  }

  async xpForPlayer(playerId: string): Promise<number> {
    const events = await db.progression.where('playerId').equals(playerId).toArray();
    return events.reduce((sum, e) => sum + e.xp, 0);
  }
}

export const profiles = new ProfileRepository();
export const matches = new MatchRepository();
export const progression = new ProgressionRepository();
