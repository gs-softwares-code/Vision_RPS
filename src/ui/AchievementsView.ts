/**
 * AchievementsView.ts — renders the achievement catalog with real progress.
 *
 * Progress is computed by the pure achievement evaluators against a context
 * built from the live score snapshot (round statistics) plus an empty match
 * aggregate. Match-based achievements stay locked until match history exists
 * (Phase 4); round-based ones progress immediately. Nothing is fabricated.
 */

import {
  createElement,
  CirclePlay,
  Trophy,
  Flame,
  Star,
  Dumbbell,
  Calendar,
  Shield,
  Gamepad2,
  Medal,
  type IconNode,
} from 'lucide';
import { achievementRepo, evaluateProgress, type AchievementContext } from '../player/Achievements';
import type { ScoreSnapshot } from '../game/ScoreManager';
import type { AchievementDef } from '../storage/db';

const ICON_MAP: Record<string, IconNode> = {
  play: CirclePlay,
  trophy: Trophy,
  flame: Flame,
  star: Star,
  dumbbell: Dumbbell,
  calendar: Calendar,
  shield: Shield,
  gamepad: Gamepad2,
};

export class AchievementsView {
  private list: HTMLElement | null = null;
  private empty: HTMLElement | null = null;
  private defs: AchievementDef[] = [];

  constructor() {
    this.list = document.getElementById('ach-list');
    this.empty = document.getElementById('ach-empty');
  }

  async load(snapshot: ScoreSnapshot): Promise<void> {
    try {
      this.defs = await achievementRepo.listDefs();
    } catch {
      this.defs = [];
    }
    this.render(snapshot);
  }

  render(snapshot: ScoreSnapshot): void {
    if (!this.list) return;

    const ctx: AchievementContext = {
      stats: {
        wins: snapshot.playerWins,
        losses: snapshot.computerWins,
        draws: snapshot.draws,
        total: snapshot.totalRounds,
        winPercentage: snapshot.winPercentage,
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
      playerId: 'guest',
    };

    this.list.textContent = '';
    if (this.empty) this.empty.style.display = this.defs.length ? 'none' : '';

    for (const def of this.defs) {
      const progress = evaluateProgress(def, ctx);
      const unlocked = progress >= 1;

      const li = document.createElement('li');
      li.className = 'ach-item' + (unlocked ? ' unlocked' : '');

      const glyph = document.createElement('span');
      glyph.className = 'ach-glyph';
      const iconDef = ICON_MAP[def.icon] ?? Medal;
      const svg = createElement(iconDef, { 'aria-hidden': 'true', focusable: 'false' });
      svg.classList.add('ach-svg');
      glyph.appendChild(svg);

      const body = document.createElement('div');
      body.className = 'ach-body';

      const head = document.createElement('div');
      head.className = 'ach-head';

      const name = document.createElement('strong');
      name.className = 'ach-name';
      name.textContent = def.name;

      const status = document.createElement('span');
      status.className = unlocked ? 'ach-status unlocked' : 'ach-status';
      status.textContent = unlocked ? 'Unlocked' : `${Math.round(progress * 100)}%`;

      head.append(name, status);

      const desc = document.createElement('p');
      desc.className = 'ach-desc';
      desc.textContent = def.description;

      const reward = document.createElement('span');
      reward.className = 'ach-reward';
      reward.textContent = `+${def.rewardXp} XP`;

      const track = document.createElement('div');
      track.className = 'ach-track';
      const fill = document.createElement('div');
      fill.className = 'ach-fill';
      fill.style.width = `${Math.max(0, Math.min(100, progress * 100))}%`;
      track.appendChild(fill);

      body.append(head, desc, reward, track);
      li.append(glyph, body);
      this.list.appendChild(li);
    }
  }
}
