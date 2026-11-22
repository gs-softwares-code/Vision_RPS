/**
 * Shell.ts — application shell: sidebar navigation + view routing.
 *
 * The shell owns the sidebar nav and the set of [data-view] sections in
 * #view-root. It swaps the visible view, keeps the nav's active state in
 * sync, and injects Lucide icons into [data-icon] slots (static HTML keeps
 * the markup readable; icons are added programmatically).
 *
 * It is intentionally free of game logic — callers subscribe via onNavigate
 * (e.g. to pause vision when leaving the Play view).
 */

import { createElement, LayoutDashboard, CirclePlay, History, BarChart3, User, Trophy, GraduationCap, Settings } from 'lucide';

export type ViewId =
  | 'dashboard'
  | 'play'
  | 'history'
  | 'statistics'
  | 'profile'
  | 'achievements'
  | 'training'
  | 'settings';

const ICONS: Record<ViewId, typeof LayoutDashboard> = {
  dashboard: LayoutDashboard,
  play: CirclePlay,
  history: History,
  statistics: BarChart3,
  profile: User,
  achievements: Trophy,
  training: GraduationCap,
  settings: Settings,
};

export interface ShellOptions {
  defaultView?: ViewId;
  onNavigate?: (view: ViewId) => void;
  onReady?: (goTo: (view: ViewId) => void) => void;
}

export class Shell {
  private views = new Map<ViewId, HTMLElement>();
  private nav = new Map<ViewId, HTMLButtonElement>();
  private current: ViewId;
  private onNavigate?: (view: ViewId) => void;

  constructor(options: ShellOptions = {}) {
    this.current = options.defaultView ?? 'play';
    this.onNavigate = options.onNavigate;

    this._collect();
    this._injectIcons();
    this._bindNav();
    this._activate(this.current);
    options.onReady?.(this.goTo);
  }

  private _collect(): void {
    document.querySelectorAll<HTMLElement>('#view-root [data-view]').forEach((section) => {
      const id = section.dataset.view as ViewId;
      if (id) this.views.set(id, section);
    });
    document.querySelectorAll<HTMLButtonElement>('.nav-item[data-nav]').forEach((btn) => {
      const id = btn.dataset.nav as ViewId;
      if (id) this.nav.set(id, btn);
    });
  }

  private _injectIcons(): void {
    this.nav.forEach((btn, id) => {
      const slot = btn.querySelector('[data-icon]');
      if (!slot) return;
      const icon = ICONS[id];
      if (!icon) return;
      const svg = createElement(icon, { 'aria-hidden': 'true', focusable: 'false' });
      svg.classList.add('nav-svg');
      slot.appendChild(svg);
    });
  }

  private _bindNav(): void {
    this.nav.forEach((btn, id) => {
      btn.addEventListener('click', () => this.goTo(id));
    });
    // Dashboard hero CTA links into Play.
    const cta = document.getElementById('cta-play');
    cta?.addEventListener('click', () => this.goTo('play'));
  }

  goTo = (view: ViewId): void => {
    if (!this.views.has(view)) return;
    if (this.current === view) return;
    this._activate(view);
    this.onNavigate?.(view);
  };

  private _activate(view: ViewId): void {
    this.current = view;
    this.views.forEach((section, id) => {
      section.classList.toggle('active', id === view);
    });
    this.nav.forEach((btn, id) => {
      btn.classList.toggle('active', id === view);
    });
  }
}
