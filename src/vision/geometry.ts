/**
 * geometry.ts — pure vector/landmark helpers for hand-gesture analysis.
 * Operates on MediaPipe HandLandmarker's 21 normalized landmarks
 * (each {x,y,z} in [0,1], z ~ depth). All functions are side-effect free
 * so they can be unit-tested in Node (Vitest).
 */

export interface Point {
  x: number;
  y: number;
  z: number;
}

/** MediaPipe hand landmark indices. */
export const FINGERS = {
  index: { mcp: 5, pip: 6, dip: 7, tip: 8 },
  middle: { mcp: 9, pip: 10, dip: 11, tip: 12 },
  ring: { mcp: 13, pip: 14, dip: 15, tip: 16 },
  pinky: { mcp: 17, pip: 18, dip: 19, tip: 20 },
} as const;

export const THUMB = { mcp: 2, ip: 3, tip: 4 } as const;

export const PALM_LANDMARKS = [0, 5, 9, 13, 17];

export const clamp = (v: number, lo = 0, hi = 1): number => Math.min(hi, Math.max(lo, v));
export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

export function sub(a: Point, b: Point): Point {
  return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
}

export function add(a: Point, b: Point): Point {
  return { x: a.x + b.x, y: a.y + b.y, z: a.z + b.z };
}

export function scale(a: Point, s: number): Point {
  return { x: a.x * s, y: a.y * s, z: a.z * s };
}

export function mag(a: Point): number {
  return Math.hypot(a.x, a.y, a.z);
}

export function normalize(a: Point): Point {
  const m = mag(a);
  if (m < 1e-9) return { x: 0, y: 0, z: 0 };
  return scale(a, 1 / m);
}

export function dot(a: Point, b: Point): number {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}

export function dist(a: Point, b: Point): number {
  return mag(sub(a, b));
}

/** Angle between vectors a and b (radians, [0, PI]). */
export function angleBetween(a: Point, b: Point): number {
  const m = mag(a) * mag(b);
  if (m < 1e-9) return 0;
  return Math.acos(clamp(dot(a, b) / m, -1, 1));
}

/** Centroid of the given landmarks (average position). */
export function centroid(landmarks: Point[]): Point {
  const s = { x: 0, y: 0, z: 0 };
  for (const p of landmarks) {
    s.x += p.x;
    s.y += p.y;
    s.z += p.z;
  }
  const n = landmarks.length || 1;
  return { x: s.x / n, y: s.y / n, z: s.z / n };
}

/** Approximate palm center using wrist + the four finger MCP joints. */
export function palmCenter(landmarks: Point[]): Point {
  return centroid(PALM_LANDMARKS.map((i) => landmarks[i]));
}

/** Typical palm "radius" (distance from center to index MCP). */
export function palmRadius(landmarks: Point[]): number {
  return dist(palmCenter(landmarks), landmarks[5]);
}

function straightnessScore(v1: Point, v2: Point, v3: Point): number {
  const angPip = angleBetween(v1, v2);
  const angDip = angleBetween(v2, v3);
  return clamp((Math.cos(angPip) + Math.cos(angDip)) / 2, 0, 1);
}

export interface FingerState {
  extended: boolean;
  score: number;
  angleScore: number;
  reachScore: number;
}

export interface ThumbState {
  extended: boolean;
  score: number;
}

export interface FingerStates {
  thumb: ThumbState;
  index: FingerState;
  middle: FingerState;
  ring: FingerState;
  pinky: FingerState;
}

/**
 * Extension score for one of the four long fingers.
 * Combines joint-straightness with how far the fingertip reaches
 * relative to its proximal phalanx (robust to hand rotation / mirroring).
 */
export function fingerState(landmarks: Point[], fingerKey: keyof typeof FINGERS): FingerState {
  const idx = FINGERS[fingerKey];
  const mcp = landmarks[idx.mcp];
  const pip = landmarks[idx.pip];
  const dip = landmarks[idx.dip];
  const tip = landmarks[idx.tip];

  const v1 = normalize(sub(pip, mcp));
  const v2 = normalize(sub(dip, pip));
  const v3 = normalize(sub(tip, dip));

  const angleScore = straightnessScore(v1, v2, v3);
  const proxLen = dist(mcp, pip) || 1e-6;
  const reachScore = clamp(dist(tip, mcp) / (proxLen * 2.3), 0, 1);

  const score = clamp(0.6 * angleScore + 0.4 * reachScore, 0, 1);
  return { extended: score >= 0.5, score, angleScore, reachScore };
}

/** Thumb extension state (used to distinguish Rock from Paper/Scissors). */
export function thumbState(landmarks: Point[]): ThumbState {
  const mcp = landmarks[THUMB.mcp];
  const ip = landmarks[THUMB.ip];
  const tip = landmarks[THUMB.tip];

  const v1 = normalize(sub(ip, mcp));
  const v2 = normalize(sub(tip, ip));
  const angIp = angleBetween(v1, v2);

  const score = clamp((Math.cos(angIp) + 1) / 2, 0, 1);
  return { extended: score >= 0.5, score };
}

/** Full finger-state map for a 21-landmark hand. */
export function computeFingerStates(landmarks: Point[]): FingerStates {
  return {
    thumb: thumbState(landmarks),
    index: fingerState(landmarks, 'index'),
    middle: fingerState(landmarks, 'middle'),
    ring: fingerState(landmarks, 'ring'),
    pinky: fingerState(landmarks, 'pinky'),
  };
}
