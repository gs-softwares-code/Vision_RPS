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

export function formatCameraError(err: unknown): { name: string; message: string } {
  if (!err) return { name: 'UnknownError', message: 'Unknown camera error.' };
  if (err instanceof DOMException || err instanceof Error) {
    const name = err.name || 'CameraError';
    if (/NotAllowedError|PermissionDeniedError/i.test(name)) {
      return {
        name,
        message: 'Camera permission denied. Please allow camera access in browser/app settings.',
      };
    }
    if (/NotFoundError|DevicesNotFoundError/i.test(name)) {
      return {
        name,
        message: 'No camera found. Please connect or enable a camera device.',
      };
    }
    if (/NotReadableError|TrackStartError/i.test(name)) {
      return {
        name,
        message: 'Camera is busy or in use by another app. Please close other camera apps.',
      };
    }
    if (/OverconstrainedError/i.test(name)) {
      return {
        name,
        message: 'Camera constraints not supported by this device.',
      };
    }
    if (/SecurityError/i.test(name)) {
      return {
        name,
        message: 'Camera requires a secure context (HTTPS or localhost).',
      };
    }
    const msg = err.message && !err.message.includes('[object') ? err.message : name;
    return { name, message: msg };
  }
  if (typeof err === 'object') {
    const rec = err as Record<string, unknown>;
    const name = typeof rec.name === 'string' ? rec.name : 'CameraError';
    const msg = typeof rec.message === 'string' && rec.message && !rec.message.includes('[object') ? rec.message : name;
    return { name, message: msg };
  }
  const str = String(err);
  return {
    name: 'CameraError',
    message: str.includes('[object') ? 'Camera access failed (Permission or device unavailable).' : str,
  };
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

    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      const errInfo = {
        name: 'NotSupportedError',
        message: 'Camera API not available. Ensure you are on HTTPS or localhost.',
      };
      this._emit('error', { code: errInfo.name, message: errInfo.message });
      throw new Error(errInfo.message);
    }

    const id = this._pickDeviceId();
    const candidateConstraints: MediaStreamConstraints[] = [
      // 1. High quality with preferred camera & facing mode
      {
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          frameRate: { ideal: 30 },
          facingMode: id ? undefined : 'user',
          deviceId: id ? { exact: id } : undefined,
        },
        audio: false,
      },
      // 2. Fallback: User front camera without exact device ID
      {
        video: { facingMode: 'user' },
        audio: false,
      },
      // 3. Fallback: Any available video capture stream
      {
        video: true,
        audio: false,
      },
    ];

    let lastError: unknown = null;
    for (const constraints of candidateConstraints) {
      try {
        this.stream = await navigator.mediaDevices.getUserMedia(constraints);
        break;
      } catch (err) {
        lastError = err;
        const name = (err as DOMException)?.name || '';
        // If permission was denied, do not retry other constraints
        if (/NotAllowedError|PermissionDeniedError|SecurityError/i.test(name)) {
          break;
        }
      }
    }

    if (!this.stream) {
      const formatted = formatCameraError(lastError);
      this._emit('error', { code: formatted.name, message: formatted.message });
      throw new Error(formatted.message);
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
