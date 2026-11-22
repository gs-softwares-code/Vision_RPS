/**
 * CameraController.ts — webcam lifecycle management.
 *
 * Responsibilities:
 *  - request camera access only after user interaction (caller decides)
 *  - enumerate devices, prefer the front-facing camera
 *  - start/stop/restart/switch, handle denial/unavailable/disconnect
 *  - stop every media track on shutdown, surface FPS
 */

export type CameraStatusType =
  | 'requesting'
  | 'active'
  | 'error'
  | 'stopped'
  | 'fps';

export interface CameraStatus {
  type: CameraStatusType;
  label?: string;
  width?: number;
  height?: number;
  code?: string;
  message?: string;
  fps?: number;
}

export interface CameraControllerOptions {
  video?: HTMLVideoElement | null;
  onStatus?: (status: CameraStatus) => void;
}

export class CameraController {
  readonly video: HTMLVideoElement | null;
  readonly onStatus: (status: CameraStatus) => void;

  stream: MediaStream | null = null;
  deviceId: string | null = null;
  devices: MediaDeviceInfo[] = [];
  running = false;
  fps = 0;

  private _frameCount = 0;
  private _fpsStart = 0;

  constructor(options: CameraControllerOptions = {}) {
    this.video = options.video ?? null;
    this.onStatus = options.onStatus ?? (() => {});
  }

  get isActive(): boolean {
    return this.running && !!this.stream?.active;
  }

  async enumerate(): Promise<MediaDeviceInfo[]> {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      this.devices = devices.filter((d) => d.kind === 'videoinput');
    } catch {
      this.devices = [];
    }
    return this.devices;
  }

  private _pickDeviceId(): string | undefined {
    if (this.deviceId) return this.deviceId;
    const front = this.devices.find((d) => /front|user/i.test(d.label));
    return front?.deviceId;
  }

  async start(): Promise<MediaStream> {
    if (this.running && this.stream) return this.stream;
    this._emit('requesting');

    const id = this._pickDeviceId();
    const constraints: MediaStreamConstraints = {
      video: {
        width: { ideal: 1280 },
        height: { ideal: 720 },
        frameRate: { ideal: 30 },
        facingMode: id ? undefined : 'user',
        deviceId: id ? { exact: id } : undefined,
      },
      audio: false,
    };

    try {
      this.stream = await navigator.mediaDevices.getUserMedia(constraints);
    } catch (err) {
      if (/overconstrained|NotFoundError|NotReadableError/i.test((err as DOMException)?.name ?? '')) {
        try {
          this.stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: 'user' },
            audio: false,
          });
        } catch (err2) {
          this._emit('error', { code: (err2 as DOMException)?.name || 'UnknownError', message: (err2 as DOMException)?.message });
          throw err2;
        }
      } else {
        this._emit('error', { code: (err as DOMException)?.name || 'UnknownError', message: (err as DOMException)?.message });
        throw err;
      }
    }

    this._attachStream(this.stream);
    this.running = true;
    this._trackFps();

    const track = this.stream.getVideoTracks()[0];
    const settings = track?.getSettings();
    this._emit('active', {
      label: track?.label || 'Camera',
      width: settings?.width,
      height: settings?.height,
    });
    return this.stream;
  }

  private _attachStream(stream: MediaStream): void {
    if (!this.video) return;
    this.video.srcObject = stream;
    try {
      void this.video.play();
    } catch {
      /* will be triggered by user gesture */
    }
  }

  async switchDevice(deviceId: string | null): Promise<MediaStream | null> {
    this.deviceId = deviceId || null;
    const wasActive = this.isActive;
    this.stop();
    if (wasActive) return this.start();
    return null;
  }

  stop(): void {
    if (this.stream) {
      this.stream.getTracks().forEach((t) => t.stop());
    }
    if (this.video) this.video.srcObject = null;
    this.stream = null;
    this.running = false;
    this.fps = 0;
    this._emit('stopped');
  }

  private _trackFps(): void {
    this._frameCount = 0;
    this._fpsStart = performance.now();
    const tick = (): void => {
      if (!this.running) return;
      this._frameCount += 1;
      const elapsed = (performance.now() - this._fpsStart) / 1000;
      if (elapsed >= 1) {
        this.fps = Math.round(this._frameCount / elapsed);
        this._frameCount = 0;
        this._fpsStart = performance.now();
        this._emit('fps', { fps: this.fps });
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  private _emit(type: CameraStatusType, payload: Partial<CameraStatus> = {}): void {
    this.onStatus({ type, ...payload });
  }
}
