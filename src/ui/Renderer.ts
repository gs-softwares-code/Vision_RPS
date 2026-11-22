/**
 * Renderer.ts — draws the mirrored camera feed + hand-skeleton overlay
 * onto a single display canvas. The raw <video> element is used only as
 * a source; the canvas is what the user sees.
 */

import type { Point } from '../vision/geometry';
import type { Classification } from '../vision/GestureClassifier';

/** Hand skeleton connections (MediaPipe landmark index pairs). */
export const HAND_CONNECTIONS: Array<[number, number]> = [
  [0, 1], [1, 2], [2, 3], [3, 4],
  [0, 5], [5, 6], [6, 7], [7, 8],
  [5, 9], [9, 10], [10, 11], [11, 12],
  [9, 13], [13, 14], [14, 15], [15, 16],
  [13, 17], [17, 18], [18, 19], [19, 20],
  [0, 17],
];

const GESTURE_LABEL: Record<string, string> = {
  rock: 'Rock',
  paper: 'Paper',
  scissors: 'Scissors',
};

export interface RendererOptions {
  canvas: HTMLCanvasElement | null;
  visible?: boolean;
}

export class Renderer {
  readonly canvas: HTMLCanvasElement | null;
  visible: boolean;
  private ctx: CanvasRenderingContext2D | null;
  private dpr = 1;

  constructor(options: RendererOptions) {
    this.canvas = options.canvas ?? null;
    this.visible = options.visible ?? true;
    this.ctx = this.canvas?.getContext('2d', { alpha: false }) ?? null;
  }

  setVisible(v: boolean): void {
    this.visible = v;
    if (this.canvas) this.canvas.style.display = v ? 'block' : 'none';
  }

  private _fit(video: HTMLVideoElement, W: number, H: number) {
    const vw = video.videoWidth || W;
    const vh = video.videoHeight || H;
    const scale = Math.min(W / vw, H / vh);
    const dw = vw * scale;
    const dh = vh * scale;
    return { dw, dh, dx: (W - dw) / 2, dy: (H - dh) / 2 };
  }

  render(video: HTMLVideoElement, landmarks: Point[] | null, classification: Classification | null): void {
    if (!this.ctx || !video) return;
    const canvas = this.canvas as HTMLCanvasElement;
    const W = canvas.clientWidth;
    const H = canvas.clientHeight;
    if (!W || !H) return;

    if (canvas.width !== W * this.dpr || canvas.height !== H * this.dpr) {
      this.dpr = window.devicePixelRatio || 1;
      canvas.width = W * this.dpr;
      canvas.height = H * this.dpr;
    }

    const ctx = this.ctx;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.fillStyle = '#0b0f1a';
    ctx.fillRect(0, 0, W, H);

    const { dx, dy, dw, dh } = this._fit(video, W, H);

    ctx.save();
    ctx.translate(dx + dw, dy);
    ctx.scale(-1, 1);
    ctx.drawImage(video, 0, 0, dw, dh);
    ctx.restore();

    if (landmarks && this.visible) {
      this._drawSkeleton(landmarks, { dx, dy, dw, dh });
    }

    if (classification && this.visible) {
      this._drawGestureBadge(classification, W, H);
    }
  }

  private _drawSkeleton(landmarks: Point[], { dx, dy, dw, dh }: { dx: number; dy: number; dw: number; dh: number }): void {
    const ctx = this.ctx as CanvasRenderingContext2D;
    const toScreen = (lm: Point): [number, number] => {
      const x = dx + (1 - lm.x) * dw;
      const y = dy + lm.y * dh;
      return [x, y];
    };

    ctx.save();
    ctx.lineWidth = Math.max(2, dw / 400);
    ctx.lineCap = 'round';

    ctx.strokeStyle = 'rgba(245, 158, 11, 0.9)';
    for (const [a, b] of HAND_CONNECTIONS) {
      const [x1, y1] = toScreen(landmarks[a]);
      const [x2, y2] = toScreen(landmarks[b]);
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    }

    ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
    landmarks.forEach((lm) => {
      const [x, y] = toScreen(lm);
      ctx.beginPath();
      ctx.arc(x, y, Math.max(2.5, dw / 320), 0, Math.PI * 2);
      ctx.fill();
    });

    ctx.restore();
  }

  private _drawGestureBadge(classification: Classification, W: number, _H: number): void {
    const ctx = this.ctx as CanvasRenderingContext2D;
    const label = GESTURE_LABEL[classification.gesture];
    if (!label) return;
    const conf = Math.round(classification.confidence * 100);
    const text = `${label}  ${conf}%`;

    ctx.save();
    ctx.font = '700 16px Inter, system-ui, sans-serif';
    const pw = ctx.measureText(text).width + 24;
    const x = W - pw - 12;
    const y = 12;
    ctx.fillStyle = 'rgba(10,14,26,0.72)';
    ctx.beginPath();
    ctx.roundRect(x, y, pw, 34, 8);
    ctx.fill();
    ctx.fillStyle = '#e2e8f0';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, x + 12, y + 18);
    ctx.restore();
  }
}
