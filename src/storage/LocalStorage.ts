/**
 * LocalStorage.ts — tiny persistence wrapper with an in-memory fallback,
 * so the app never crashes when storage is blocked (e.g. privacy mode).
 * All keys are namespaced under "vision-rps:".
 */

import type { StorageAdapter } from '../game/ScoreManager';

export const PREFIX = 'vision-rps:';

function safeGetStorage(): Storage | null {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const probe = '__vision_rps_probe__';
      window.localStorage.setItem(probe, '1');
      window.localStorage.removeItem(probe);
      return window.localStorage;
    }
  } catch {
    /* ignore */
  }
  return null;
}

export class LocalStorage implements StorageAdapter {
  private _store: Storage | null;
  private _memory = new Map<string, string>();
  readonly enabled: boolean;

  constructor(options: { store?: Storage | null } = {}) {
    this._store = options.store ?? safeGetStorage();
    this.enabled = Boolean(this._store);
  }

  key(k: string): string {
    return PREFIX + k;
  }

  getItem(key: string): string | null {
    const full = this.key(key);
    if (this._store) return this._store.getItem(full);
    return this._memory.get(full) ?? null;
  }

  setItem(key: string, value: string): void {
    const full = this.key(key);
    if (this._store) this._store.setItem(full, value);
    else this._memory.set(full, value);
  }

  removeItem(key: string): void {
    const full = this.key(key);
    if (this._store) this._store.removeItem(full);
    else this._memory.delete(full);
  }
}
