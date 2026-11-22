/**
 * Dashboard.ts — scoreboard + round history DOM updates.
 */

import type { ScoreSnapshot } from '../game/ScoreManager';
import type { Round } from '../game/GameEngine';
import type { RoundResult } from '../game/ScoreManager';

const RESULT_TEXT: Record<RoundResult, string> = {
  win: 'Player win',
  lose: 'Computer win',
  draw: 'Draw',
};

export interface DashboardElements {
  playerWins?: HTMLElement | null;
  computerWins?: HTMLElement | null;
  draws?: HTMLElement | null;
  totalRounds?: HTMLElement | null;
  winPct?: HTMLElement | null;
  lastPlayerGesture?: HTMLElement | null;
  lastComputerGesture?: HTMLElement | null;
  lastResult?: HTMLElement | null;
  resultBanner?: HTMLElement | null;
  historyList?: HTMLElement | null;
}

export class Dashboard {
  els: DashboardElements;

  constructor({ els = {} }: { els?: DashboardElements } = {}) {
    this.els = els;
  }

  updateScores(snap: ScoreSnapshot): void {
    const set = (id: keyof DashboardElements, value: number | string): void => {
      const el = this.els[id] as HTMLElement | null | undefined;
      if (el) el.textContent = String(value);
    };
    set('playerWins', snap.playerWins);
    set('computerWins', snap.computerWins);
    set('draws', snap.draws);
    set('totalRounds', snap.totalRounds);
    set('winPct', `${snap.winPercentage}%`);
  }

  showRound(round: Round): void {
    const setText = (id: keyof DashboardElements, text: string): void => {
      const el = this.els[id] as HTMLElement | null | undefined;
      if (el) el.textContent = text;
    };
    setText('lastPlayerGesture', round.player);
    setText('lastComputerGesture', round.computer);
    setText('lastResult', RESULT_TEXT[round.result]);
    this.els.lastResult?.classList.remove('win', 'lose', 'draw');
    this.els.lastResult?.classList.add(round.result);
  }

  showResultBanner(result: RoundResult | null): void {
    if (!this.els.resultBanner) return;
    this.els.resultBanner.textContent = result ? RESULT_TEXT[result] : '';
    this.els.resultBanner.classList.remove('win', 'lose', 'draw', 'show');
    void this.els.resultBanner.offsetWidth; // restart CSS animation
    if (result) this.els.resultBanner.classList.add(result, 'show');
  }

  hideResultBanner(): void {
    this.els.resultBanner?.classList.remove('show');
  }

  appendHistory(round: Round): void {
    const list = this.els.historyList;
    if (!list) return;
    const li = document.createElement('li');
    li.className = 'history-item';
    const time = new Date(round.timestamp).toLocaleTimeString();

    const timeSpan = document.createElement('span');
    timeSpan.className = 'history-time';
    timeSpan.textContent = time;

    const playerSpan = document.createElement('span');
    playerSpan.className = 'history-move';
    playerSpan.textContent = round.player;

    const vsSpan = document.createElement('span');
    vsSpan.className = 'history-vs';
    vsSpan.textContent = 'vs';

    const compSpan = document.createElement('span');
    compSpan.className = 'history-move';
    compSpan.textContent = round.computer;

    const resultSpan = document.createElement('span');
    resultSpan.className = `history-result ${round.result}`;
    resultSpan.textContent = RESULT_TEXT[round.result];

    li.append(timeSpan, playerSpan, vsSpan, compSpan, resultSpan);
    list.prepend(li);
    while (list.children.length > 12) {
      list.lastElementChild?.remove();
    }
  }

  resetHistory(): void {
    if (this.els.historyList) this.els.historyList.innerHTML = '';
    this.showResultBanner(null);
  }
}
