/**
 * App.ts — Vision RPS application wiring (camera + vision + game + UI).
 * Bootstrap is handled by src/main.ts.
 */

import { CameraController, formatCameraError } from '../camera/CameraController';
import { FrameProcessor } from '../camera/FrameProcessor';
import { VisionEngine } from '../vision/VisionEngine';
import { classify as classifyGesture, type Classification } from '../vision/GestureClassifier';
import { GestureStabilizer } from '../vision/GestureStabilizer';
import { GameEngine, type Round } from '../game/GameEngine';
import { ScoreManager } from '../game/ScoreManager';
import { LocalStorage } from '../storage/LocalStorage';
import { Renderer } from '../ui/Renderer';
import { Dashboard } from '../ui/Dashboard';
import { Settings, type SettingsKey, type SettingsValues } from '../ui/Settings';
import { Shell, type ViewId } from '../ui/Shell';
import { StatisticsView } from '../ui/StatisticsView';
import { AchievementsView } from '../ui/AchievementsView';
import { ProfileView } from '../ui/ProfileView';

const $ = (id: string): HTMLElement => document.getElementById(id) as HTMLElement;

export class VisionRPSApp {
  storage = new LocalStorage();
  settings!: Settings;
  scores!: ScoreManager;
  game!: GameEngine;
  classifier = { classify: (lms: unknown[], handedness: string): Classification => classifyGesture(lms as never, handedness) };
  stabilizer!: GestureStabilizer;
  camera: CameraController | null = null;
  vision: VisionEngine | null = null;
  processor: FrameProcessor | null = null;
  private video: HTMLVideoElement | null = null;
  private roundActive = false;
  private running = false;
  private renderer!: Renderer;
  private dashboard!: Dashboard;
  private statisticsView!: StatisticsView;
  private achievementsView!: AchievementsView;
  private profileView!: ProfileView;

  init(): void {
    this.settings = new Settings({ storage: this.storage, onChange: (k, v) => this._onSetting(k, v) });
    this.scores = new ScoreManager({ storage: this.storage });
    this.game = new GameEngine({ scores: this.scores });
    this.stabilizer = new GestureStabilizer({
      minConfidence: this.settings.get('confidence'),
      requiredFrames: this.settings.get('stabilityFrames'),
    });

    this.renderer = new Renderer({ canvas: $('overlay') as HTMLCanvasElement, visible: this.settings.get('visualize') });
    this.dashboard = new Dashboard({
      els: {
        playerWins: $('stat-player'),
        computerWins: $('stat-computer'),
        draws: $('stat-draws'),
        totalRounds: $('stat-total'),
        winPct: $('stat-winpct'),
        lastPlayerGesture: $('last-player'),
        lastComputerGesture: $('last-computer'),
        lastResult: $('last-result'),
        resultBanner: $('result-banner'),
        historyList: $('history-list'),
      },
    });

    new Shell({
      defaultView: 'play',
      onNavigate: (view) => this._onNavigate(view),
    });
    this.statisticsView = new StatisticsView();
    this.achievementsView = new AchievementsView();
    this.profileView = new ProfileView({
      storage: this.storage,
      onProfileUpdate: (p) => {
        const welcome = $('dash-welcome-name');
        if (welcome) welcome.textContent = p.name;
      },
    });

    this._bind();
    this._refreshStats();
    void this.achievementsView.load(this.scores.snapshot());
    this.profileView.render(this.scores.snapshot());
    this.settings.applyToDom({
      confidence: $('conf-confidence') as HTMLInputElement,
      confidenceOut: $('conf-confidence-out'),
      stability: $('conf-stability') as HTMLInputElement,
      stabilityOut: $('conf-stability-out'),
      sound: $('conf-sound') as HTMLInputElement,
      visualize: $('conf-visualize') as HTMLInputElement,
    });
    void this._populateCameraSelect();
    this._updateThemeToggleBtn(this.settings.get('theme'));
  }

  private _bind(): void {
    $('btn-enable').addEventListener('click', () => void this._enable());
    $('btn-disable').addEventListener('click', () => this._disable());
    $('btn-reset-stats').addEventListener('click', () => this._resetStats());

    $('conf-confidence').addEventListener('input', (e) => {
      this.settings.set('confidence', Number((e.target as HTMLInputElement).value) / 100);
    });
    $('conf-stability').addEventListener('input', (e) => {
      this.settings.set('stabilityFrames', Number((e.target as HTMLInputElement).value));
    });
    $('conf-sound').addEventListener('change', (e) => {
      this.settings.set('sound', (e.target as HTMLInputElement).checked);
    });
    $('conf-visualize').addEventListener('change', (e) => {
      this.settings.set('visualize', (e.target as HTMLInputElement).checked);
    });
    $('conf-camera').addEventListener('change', (e) => {
      this.settings.set('cameraId', (e.target as HTMLSelectElement).value);
    });

    const themeBtn = $('btn-theme-toggle');
    themeBtn?.addEventListener('click', () => {
      const nextTheme = this.settings.get('theme') === 'dark' ? 'light' : 'dark';
      this.settings.set('theme', nextTheme);
    });
  }

  private async _enable(): Promise<void> {
    if (this.running) return;
    this.video = $('webcam') as HTMLVideoElement;
    this.camera = new CameraController({ video: this.video, onStatus: (s) => this._onCameraStatus(s) });
    this.vision = new VisionEngine({ onStatus: (s) => this._onEngineStatus(s) });

    try {
      await this.camera.start();
    } catch (err) {
      const formatted = formatCameraError(err);
      this._setStatus('system-status', `Camera: ${formatted.message}`, true);
      this._disable(formatted.message);
      return;
    }

    try {
      await this.vision.init();
    } catch (err) {
      const raw = err instanceof Error ? err.message : String(err);
      const cleanMsg = raw.includes('[object') ? 'Failed to load gesture recognition model.' : raw;
      this._setStatus('system-status', `Vision error: ${cleanMsg}`, true);
      this._disable(`Vision error: ${cleanMsg}`);
      return;
    }

    this.processor = new FrameProcessor({
      vision: this.vision,
      classifier: this.classifier,
      stabilizer: this.stabilizer,
      renderer: this.renderer,
      onResult: (r) => this._onResult(r),
      onFps: (fps) => this._setText('fps', `${fps} fps`),
    });
    this.processor.start(this.video);
    this.running = true;

    ($('btn-enable') as HTMLButtonElement).disabled = true;
    ($('btn-disable') as HTMLButtonElement).disabled = false;
    this._setStatus('system-status', 'System ready', false);
  }

  private _disable(errorMessage?: string): void {
    this.running = false;
    this.processor?.stop();
    this.processor = null;
    this.camera?.stop();
    this.vision?.dispose();
    this.camera = null;
    this.vision = null;
    this.stabilizer.reset();

    ($('btn-enable') as HTMLButtonElement).disabled = false;
    ($('btn-disable') as HTMLButtonElement).disabled = true;
    if (errorMessage) {
      this._setStatus('camera-status', errorMessage, true);
    } else {
      this._setStatus('camera-status', 'Camera off', false);
    }
  }

  private _onCameraStatus(s: { type: string; label?: string; width?: number; height?: number; code?: string; message?: string }): void {
    if (s.type === 'active') {
      this._setStatus('camera-status', `${s.label ?? 'Camera'} · ${s.width ?? '?'}×${s.height ?? '?'}`, false);
    } else if (s.type === 'error') {
      const msg = s.message || (s.code && s.code !== 'Object' ? `Camera error: ${s.code}` : 'Camera permission or device error');
      this._setStatus('camera-status', msg, true);
    } else if (s.type === 'stopped') {
      const el = $('camera-status');
      if (!el?.classList.contains('error')) {
        this._setStatus('camera-status', 'Camera off', false);
      }
    }
  }

  private _onEngineStatus(s: { type: string }): void {
    const map: Record<string, string> = {
      'loading-wasm': 'Loading vision runtime (WASM)…',
      'loading-model': 'Loading hand model…',
      'creating-landmarker': 'Creating landmarker…',
      ready: 'System ready',
      'wasm-fallback': 'Vision runtime fallback (no SIMD)',
      'gpu-fallback': 'GPU unavailable — using CPU',
    };
    const text = map[s.type] || '';
    if (text) this._setStatus('system-status', text, false);
  }

  private _onResult(r: { landmarks: unknown[] | null; classification: Classification | null }): void {
    if (!r.landmarks) {
      this._clearRecognition();
      return;
    }

    this._setText('rec-confidence', `${Math.round((r.classification?.confidence ?? 0) * 100)}%`);
    this._setText('rec-gesture', r.classification?.gesture || '—');

    if (this.roundActive) return;

    const stab = this.stabilizer.push({ gesture: r.classification?.gesture ?? null, confidence: r.classification?.confidence ?? 0 });
    if (stab.phase === 'stable') {
      const gesture = this.stabilizer.confirm();
      if (gesture && this.game.canLock) {
        this._startRound(gesture);
      }
    }
  }

  private _startRound(gesture: string): void {
    this.roundActive = true;
    this.game.lock(gesture as never);
    this._playCountdown(['3', '2', '1', 'SHOOT'], () => this._revealRound());
  }

  private _playCountdown(steps: string[], onDone: () => void): void {
    let i = 0;
    const show = (): void => {
      if (this.roundActive === false) return;
      const el = $('countdown');
      el.textContent = steps[i];
      el.classList.add('show');
      void el.offsetWidth;
      if (i < steps.length - 1) {
        window.setTimeout(show, 700);
      } else {
        window.setTimeout(() => el.classList.remove('show'), 450);
        window.setTimeout(onDone, 500);
      }
      i += 1;
    };
    show();
  }

  private _revealRound(): void {
    if (!this.roundActive) return;
    let round: Round;
    try {
      round = this.game.shoot();
    } catch {
      this.roundActive = false;
      return;
    }
    this.dashboard.showRound(round);
    this.dashboard.appendHistory(round);
    this._updateHistoryEmpty();
    this.dashboard.showResultBanner(round.result);
    this._refreshStats();
    if (this.settings.get('sound')) this._beep(round.result);

    window.setTimeout(() => {
      this.game.next();
      this.dashboard.hideResultBanner();
      this.roundActive = false;
    }, 1400);
  }

  private _refreshStats(): void {
    const snap = this.scores.snapshot();
    this.dashboard.updateScores(snap);
    this.statisticsView.update(snap);
    this.profileView.render(snap);
    this._set('dash-player', snap.playerWins);
    this._set('dash-computer', snap.computerWins);
    this._set('dash-draws', snap.draws);
    this._set('dash-total', snap.totalRounds);
    this._set('dash-winpct', `${snap.winPercentage}%`);
  }

  private _onNavigate(view: ViewId): void {
    if (view === 'play') {
      this._resumeProcessing();
    } else {
      this._pauseProcessing();
    }
  }

  private _pauseProcessing(): void {
    if (this.running && this.processor) this.processor.stop();
  }

  private _resumeProcessing(): void {
    if (this.running && this.processor && this.video) this.processor.start(this.video);
  }

  private _set(id: string, value: number | string): void {
    const el = $(id);
    if (el) el.textContent = String(value);
  }

  private _resetStats(): void {
    this.scores.resetPersisted();
    this.game.reset();
    this.dashboard.resetHistory();
    this._updateHistoryEmpty();
    this._refreshStats();
    this.stabilizer.reset();
  }

  private _updateHistoryEmpty(): void {
    const list = $('history-list');
    const empty = $('history-empty');
    if (!list || !empty) return;
    empty.style.display = list.children.length ? 'none' : '';
  }

  private async _populateCameraSelect(): Promise<void> {
    const select = $('conf-camera') as HTMLSelectElement;
    let devices: MediaDeviceInfo[] = [];
    try {
      devices = (await navigator.mediaDevices.enumerateDevices()).filter((d) => d.kind === 'videoinput');
    } catch {
      /* no camera enumeration available */
    }
    select.innerHTML = '';
    const none = document.createElement('option');
    none.value = '';
    none.textContent = 'Auto';
    select.appendChild(none);
    devices.forEach((d) => {
      const opt = document.createElement('option');
      opt.value = d.deviceId;
      opt.textContent = d.label || `Camera ${select.options.length}`;
      select.appendChild(opt);
    });
    select.value = this.settings.get('cameraId') || '';
  }

  private _onSetting(key: SettingsKey, value: SettingsValues[SettingsKey]): void {
    if (key === 'confidence') {
      this.stabilizer.minConfidence = value as number;
      const out = $('conf-confidence-out');
      if (out) out.textContent = `${Math.round((value as number) * 100)}%`;
    }
    if (key === 'stabilityFrames') {
      this.stabilizer.requiredFrames = value as number;
      const out = $('conf-stability-out');
      if (out) out.textContent = String(value);
    }
    if (key === 'visualize') this.renderer.setVisible(value as boolean);
    if (key === 'theme') {
      document.documentElement.setAttribute('data-theme', value as string);
      this._updateThemeToggleBtn(value as string);
    }
    if (key === 'cameraId' && this.running && value) {
      void this.camera?.switchDevice(value as string);
    }
  }

  private _setStatus(id: string, text: string, isError: boolean): void {
    const el = $(id);
    if (!el) return;
    el.textContent = text;
    el.classList.toggle('error', isError);
  }

  private _setText(id: string, text: string): void {
    const el = $(id);
    if (el) el.textContent = text;
  }

  private _clearRecognition(): void {
    this._setText('rec-gesture', '—');
    this._setText('rec-confidence', '—');
  }

  private _beep(result: 'win' | 'lose' | 'draw'): void {
    try {
      const Ctx = window.AudioContext || (window as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      const ctx = new Ctx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.value = result === 'win' ? 660 : result === 'lose' ? 440 : 550;
      gain.gain.setValueAtTime(0.12, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.25);
      osc.connect(gain).connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.3);
      osc.onended = () => void ctx.close();
    } catch {
      /* audio is optional */
    }
  }

  private _updateThemeToggleBtn(theme: string): void {
    const btn = $('btn-theme-toggle') as HTMLButtonElement | null;
    if (!btn) return;
    const isDark = theme === 'dark';
    btn.setAttribute('aria-label', isDark ? 'Switch to light mode' : 'Switch to dark mode');
    btn.title = isDark ? 'Switch to light mode' : 'Switch to dark mode';
    btn.innerHTML = isDark
      ? '<svg class="nav-svg" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="4"></circle><path d="M12 2v2"></path><path d="M12 20v2"></path><path d="m4.93 4.93 1.41 1.41"></path><path d="m17.66 17.66 1.41 1.41"></path><path d="M2 12h2"></path><path d="M20 12h2"></path><path d="m6.34 17.66-1.41 1.41"></path><path d="m19.07 4.93-1.41 1.41"></path></svg><span class="theme-label">Light</span>'
      : '<svg class="nav-svg" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"></path></svg><span class="theme-label">Dark</span>';
  }
}
