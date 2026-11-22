/**
 * FrameProcessor.ts — the per-frame pipeline loop.
 *
 * Camera frame → MediaPipe inference → classification → stabilizer → emit.
 * Reuses the incoming video element directly (no intermediate canvas copy),
 * guards against overlapping inference, and keeps rendering on rAF.
 */

import type { VisionEngine } from '../vision/VisionEngine';
import type { Classification } from '../vision/GestureClassifier';
import type { GestureStabilizer } from '../vision/GestureStabilizer';
import type { Renderer } from '../ui/Renderer';
import type { NormalizedLandmark } from '@mediapipe/tasks-vision';

export interface FrameResult {
  landmarks: NormalizedLandmark[] | null;
  classification: Classification | null;
  timestamp: number;
}

export interface FrameProcessorOptions {
  vision: VisionEngine;
  classifier: { classify(lms: unknown[], handedness: string): Classification };
  stabilizer: GestureStabilizer;
  renderer: Renderer | null;
  onResult?: (result: FrameResult) => void;
  onFps?: (fps: number) => void;
}

export class FrameProcessor {
  readonly vision: VisionEngine;
  readonly classifier: FrameProcessorOptions['classifier'];
  readonly stabilizer: GestureStabilizer;
  readonly renderer: Renderer | null;
  readonly onResult?: (result: FrameResult) => void;
  readonly onFps?: (fps: number) => void;

  private _video: HTMLVideoElement | null = null;
  private _running = false;
  private _busy = false;
  private _frameCount = 0;
  private _fpsStart = 0;
  fps = 0;

  constructor(options: FrameProcessorOptions) {
    this.vision = options.vision;
    this.classifier = options.classifier;
    this.stabilizer = options.stabilizer;
    this.renderer = options.renderer ?? null;
    this.onResult = options.onResult;
    this.onFps = options.onFps;
  }

  start(video: HTMLVideoElement): void {
    this._video = video;
    this._running = true;
    this._frameCount = 0;
    this._fpsStart = performance.now();
    requestAnimationFrame(() => this._loop());
  }

  stop(): void {
    this._running = false;
  }

  private _loop(): void {
    if (!this._running) return;
    requestAnimationFrame(() => this._loop());

    const video = this._video;
    if (!video || video.readyState < 2) return;

    const ts = performance.now();
    let landmarks: NormalizedLandmark[] | null = null;
    let handedness = 'Unknown';

    if (!this._busy) {
      this._busy = true;
      try {
        const res = this.vision.detectForVideo(video, ts);
        if (res?.landmarks?.length) {
          landmarks = res.landmarks[0];
          handedness = res.handedness?.[0]?.[0]?.categoryName ?? 'Unknown';
        }
      } catch {
        /* a single detection error should not kill the loop */
      } finally {
        this._busy = false;
      }
    }

    let classification: Classification | null = null;
    if (landmarks) {
      classification = this.classifier.classify(landmarks, handedness);
    }

    if (this.renderer) {
      this.renderer.render(video, landmarks, classification);
    }

    if (this.onResult) {
      this.onResult({ landmarks, classification, timestamp: ts });
    }

    this._tickFps();
  }

  private _tickFps(): void {
    this._frameCount += 1;
    const elapsed = (performance.now() - this._fpsStart) / 1000;
    if (elapsed >= 1) {
      this.fps = Math.round(this._frameCount / elapsed);
      this._frameCount = 0;
      this._fpsStart = performance.now();
      this.onFps?.(this.fps);
    }
  }
}
