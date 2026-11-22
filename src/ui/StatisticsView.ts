/**
 * StatisticsView.ts — real aggregate statistics (W/L/D totals + a Chart.js
 * doughnut of the outcome mix). Backed entirely by the live ScoreManager
 * snapshot; no fabricated numbers.
 */

import { Chart } from 'chart.js/auto';
import type { ScoreSnapshot } from '../game/ScoreManager';

const COLORS = {
  win: '#34d399',
  lose: '#f87171',
  draw: '#94a3b8',
};

export class StatisticsView {
  private chart: Chart | null = null;
  private canvas: HTMLCanvasElement | null;
  private els: { total: HTMLElement | null; wins: HTMLElement | null; losses: HTMLElement | null; draws: HTMLElement | null; winPct: HTMLElement | null };

  constructor() {
    this.canvas = document.getElementById('stat-chart') as HTMLCanvasElement | null;
    this.els = {
      total: document.getElementById('stat-total2'),
      wins: document.getElementById('stat-wins'),
      losses: document.getElementById('stat-losses'),
      draws: document.getElementById('stat-draws2'),
      winPct: document.getElementById('stat-winpct2'),
    };
  }

  update(snap: ScoreSnapshot): void {
    this._set(this.els.total, snap.totalRounds);
    this._set(this.els.wins, snap.playerWins);
    this._set(this.els.losses, snap.computerWins);
    this._set(this.els.draws, snap.draws);
    this._set(this.els.winPct, `${snap.winPercentage}%`);

    if (!this.canvas) return;
    const data = [snap.playerWins, snap.computerWins, snap.draws];
    if (!this.chart) {
      this.chart = new Chart(this.canvas, {
        type: 'doughnut',
        data: {
          labels: ['Wins', 'Losses', 'Draws'],
          datasets: [{
            data,
            backgroundColor: [COLORS.win, COLORS.lose, COLORS.draw],
            borderColor: '#0b0f1a',
            borderWidth: 3,
          }],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { position: 'bottom', labels: { color: '#94a3b8' } },
          },
        },
      });
    } else {
      this.chart.data.datasets[0].data = data;
      this.chart.update();
    }
  }

  private _set(el: HTMLElement | null, value: number | string): void {
    if (el) el.textContent = String(value);
  }
}
