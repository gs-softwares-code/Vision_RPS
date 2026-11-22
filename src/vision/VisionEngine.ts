/**
 * VisionEngine.ts — MediaPipe Tasks Vision HandLandmarker lifecycle.
 *
 * Reliable initialization:
 *  - vendored local ESM bundle + WASM runtimes (offline-capable)
 *  - model loaded from a local override when present, else from CDN
 *  - GPU delegate attempted first, automatic CPU fallback
 *  - guarded against repeated init / race conditions
 *  - explicit dispose() releases native resources
 */

import {
  FilesetResolver,
  HandLandmarker,
  type HandLandmarkerResult,
} from '@mediapipe/tasks-vision';

// Public assets are served and built from the site root (Vite / static hosting).
const WASM_PATH = 'vendor/wasm/';
const DEFAULT_MODEL_CDN =
  'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task';
const LOCAL_MODEL = 'models/hand_landmarker.task';

export type EngineStatusType =
  | 'loading-wasm'
  | 'loading-model'
  | 'creating-landmarker'
  | 'ready'
  | 'wasm-error'
  | 'wasm-fallback'
  | 'gpu-fallback'
  | 'gpu-error';

export interface EngineStatus {
  type: EngineStatusType;
  detail?: string;
  model?: string;
  delegate?: 'GPU' | 'CPU';
}

type EmitDetail = string | { model?: string; delegate?: 'GPU' | 'CPU' };

/** Resolve a project-relative path against the current document URL. */
function toAbsolute(p: string): string {
  try {
    return new URL(p, globalThis.location?.href).href;
  } catch {
    return p;
  }
}

async function resolveModelUrl(): Promise<string> {
  const localAbs = toAbsolute(LOCAL_MODEL);
  try {
    const res = await fetch(localAbs);
    if (res.ok) return localAbs;
  } catch {
    /* fallback to CDN */
  }
  return DEFAULT_MODEL_CDN;
}

export interface VisionEngineOptions {
  modelPath?: string;
  numHands?: number;
  onStatus?: (status: EngineStatus) => void;
}

export class VisionEngine {
  modelPath: string;
  numHands: number;
  onStatus: (status: EngineStatus) => void;

  landmarker: HandLandmarker | null = null;
  delegate: 'GPU' | 'CPU' | null = null;
  private _starting: Promise<HandLandmarker> | null = null;
  disposed = false;

  constructor(options: VisionEngineOptions = {}) {
    this.modelPath = options.modelPath ?? '';
    this.numHands = options.numHands ?? 1;
    this.onStatus = options.onStatus ?? (() => {});
  }

  get isReady(): boolean {
    return !!this.landmarker;
  }

  /** Initialize once. Reuses an in-flight promise when called repeatedly. */
  init(): Promise<HandLandmarker> {
    if (this.landmarker) return Promise.resolve(this.landmarker);
    if (this._starting) return this._starting;

    this._starting = this._boot().finally(() => {
      this._starting = null;
    });
    return this._starting;
  }

  private async _boot(): Promise<HandLandmarker> {
    const modelPath = this.modelPath || (await resolveModelUrl());

    this._emit('loading-wasm');
    const wasmBase = toAbsolute(WASM_PATH);
    let fileset: Awaited<ReturnType<typeof FilesetResolver.forVisionTasks>>;
    try {
      fileset = await FilesetResolver.forVisionTasks(wasmBase);
    } catch (err) {
      this._emit('wasm-error', String(err));
      throw err;
    }

    this._emit('loading-model');
    await this._fetchModel(modelPath);

    this._emit('creating-landmarker');
    try {
      this.landmarker = await HandLandmarker.createFromOptions(fileset, {
        baseOptions: {
          modelAssetPath: modelPath,
          delegate: 'GPU',
        },
        runningMode: 'VIDEO',
        numHands: this.numHands,
        minHandDetectionConfidence: 0.5,
        minHandPresenceConfidence: 0.5,
        minTrackingConfidence: 0.5,
      });
      this.delegate = 'GPU';
    } catch (err) {
      this._emit('gpu-fallback', String(err));
      this.landmarker = await HandLandmarker.createFromOptions(fileset, {
        baseOptions: { modelAssetPath: modelPath, delegate: 'CPU' },
        runningMode: 'VIDEO',
        numHands: this.numHands,
      });
      this.delegate = 'CPU';
    }

    this._emit('ready', { model: modelPath, delegate: this.delegate });
    return this.landmarker as HandLandmarker;
  }

  private async _fetchModel(path: string): Promise<void> {
    if (/^https?:/.test(path)) return;
    const res = await fetch(path);
    if (!res.ok) throw new Error(`Model download failed: ${path} (${res.status})`);
  }

  detectForVideo(video: HTMLVideoElement, timestampMs: number): HandLandmarkerResult | null {
    if (!this.landmarker || !video || video.readyState < 2) return null;
    return this.landmarker.detectForVideo(video, timestampMs);
  }

  dispose(): void {
    this.disposed = true;
    if (this.landmarker) {
      try {
        this.landmarker.close();
      } catch {
        /* ignore */
      }
      this.landmarker = null;
    }
  }

  private _emit(type: EngineStatusType, detail?: EmitDetail): void {
    if (typeof detail === 'string') {
      this.onStatus({ type, detail });
    } else {
      this.onStatus({ type, ...detail });
    }
  }
}
