/**
 * Ambient type declarations for the vendored MediaPipe Tasks Vision bundle
 * (public/vendor/vision_bundle.mjs). The bundle is a prebuilt third-party
 * artifact without bundled types; we declare only the surface we use.
 */

declare module '@mediapipe/tasks-vision' {
  export interface NormalizedLandmark {
    x: number;
    y: number;
    z: number;
  }

  export interface Category {
    index: number;
    score: number;
    categoryName: string;
  }

  export interface HandLandmarkerResult {
    landmarks: NormalizedLandmark[][];
    worldLandmarks?: NormalizedLandmark[][];
    handedness: Category[][];
    handednesses?: Category[][];
  }

  export interface HandLandmarkerOptions {
    baseOptions: {
      modelAssetPath: string;
      delegate?: 'GPU' | 'CPU';
    };
    runningMode?: 'VIDEO' | 'IMAGE';
    numHands?: number;
    minHandDetectionConfidence?: number;
    minHandPresenceConfidence?: number;
    minTrackingConfidence?: number;
  }

  export interface HandLandmarker {
    detectForVideo(video: HTMLVideoElement, timestampMs: number): HandLandmarkerResult;
    detect(video: HTMLVideoElement | ImageBitmap | HTMLImageElement): HandLandmarkerResult;
    close(): void;
  }

  export interface FilesetResolver {
    forVisionTasks(baseDirectory: string): Promise<VisionTaskFileset>;
  }

  export interface VisionTaskFileset {
    [key: string]: unknown;
  }

  export const FilesetResolver: FilesetResolver;
  export const HandLandmarker: {
    createFromOptions(
      fileset: VisionTaskFileset,
      options: HandLandmarkerOptions,
    ): Promise<HandLandmarker>;
  };
}
