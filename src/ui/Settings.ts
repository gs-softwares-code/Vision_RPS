/**
 * Settings.ts — user preferences, stored in localStorage, surfaced to the
 * rest of the app through a small subscriber list.
 */

import type { StorageAdapter } from '../game/ScoreManager';

export interface SettingsValues {
  confidence: number;
  stabilityFrames: number;
  sound: boolean;
  visualize: boolean;
  cameraId: string | null;
  theme: 'dark' | 'light';
}

const DEFAULTS: SettingsValues = {
  confidence: 0.55,
  stabilityFrames: 3,
  sound: true,
  visualize: true,
  cameraId: null,
  theme: 'dark',
};

export type SettingsKey = keyof SettingsValues;

export interface SettingsOptions {
  storage?: StorageAdapter | null;
  onChange?: (key: SettingsKey, value: SettingsValues[SettingsKey]) => void;
}

export interface SettingsDomEls {
  confidence?: HTMLInputElement | null;
  confidenceOut?: HTMLElement | null;
  stability?: HTMLInputElement | null;
  stabilityOut?: HTMLElement | null;
  sound?: HTMLInputElement | null;
  visualize?: HTMLInputElement | null;
  themeToggle?: HTMLButtonElement | null;
}

export class Settings {
  readonly storage: StorageAdapter | null;
  readonly onChange?: (key: SettingsKey, value: SettingsValues[SettingsKey]) => void;

  values: SettingsValues;

  constructor(options: SettingsOptions = {}) {
    this.storage = options.storage ?? null;
    this.onChange = options.onChange;
    this.values = { ...DEFAULTS };
    this._load();
  }

  private _key(): string {
    return 'settings';
  }

  private _load(): void {
    try {
      const raw = this.storage?.getItem(this._key());
      if (raw) this.values = { ...DEFAULTS, ...(JSON.parse(raw) as Partial<SettingsValues>) };
    } catch {
      this.values = { ...DEFAULTS };
    }
  }

  private _save(): void {
    this.storage?.setItem(this._key(), JSON.stringify(this.values));
  }

  get<K extends SettingsKey>(key: K): SettingsValues[K] {
    return this.values[key];
  }

  set<K extends SettingsKey>(key: K, value: SettingsValues[K]): void {
    this.values[key] = value;
    this._save();
    this.onChange?.(key, value);
  }

  applyToDom(els: SettingsDomEls): void {
    if (els.confidence) els.confidence.value = String(Math.round(this.values.confidence * 100));
    if (els.confidenceOut) els.confidenceOut.textContent = `${Math.round(this.values.confidence * 100)}%`;
    if (els.stability) els.stability.value = String(this.values.stabilityFrames);
    if (els.stabilityOut) els.stabilityOut.textContent = String(this.values.stabilityFrames);
    if (els.sound) els.sound.checked = this.values.sound;
    if (els.visualize) els.visualize.checked = this.values.visualize;
    document.documentElement.setAttribute('data-theme', this.values.theme);
  }
}
