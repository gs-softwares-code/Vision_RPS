/**
 * GestureClassifier.ts — landmark-based Rock/Paper/Scissors classification.
 *
 * Pure logic: turns a 21-landmark hand (+ optional handedness) into a
 * structured result. Independent of the DOM/camera/MediaPipe so it can be
 * unit-tested against synthetic landmark fixtures.
 */

import { computeFingerStates, clamp, type Point, type FingerStates } from './geometry';

export const GESTURES = {
  ROCK: 'rock',
  PAPER: 'paper',
  SCISSORS: 'scissors',
  UNKNOWN: 'unknown',
} as const;

export type Gesture = (typeof GESTURES)[keyof typeof GESTURES];

export interface ClassifyOptions {
  minExtension?: number;
  minThumb?: number;
  minConfidence?: number;
}

const DEFAULT_OPTIONS: Required<ClassifyOptions> = {
  minExtension: 0.5,
  minThumb: 0.45,
  minConfidence: 0.55,
};

export interface Classification {
  gesture: Gesture;
  confidence: number;
  fingers: FingerStates | null;
  handedness: string;
}

function fourExtended(states: FingerStates, minExtension: number): string[] {
  return ['index', 'middle', 'ring', 'pinky'].filter((k) => {
    const s = states[k as keyof FingerStates] as { extended: boolean; score: number };
    return s.extended && s.score >= minExtension;
  });
}

function avg(scores: number[]): number {
  return scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
}

/**
 * Classify a hand.
 */
export function classify(
  landmarks: Point[],
  handedness = 'Unknown',
  options: ClassifyOptions = {},
): Classification {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  if (!Array.isArray(landmarks) || landmarks.length !== 21) {
    return { gesture: GESTURES.UNKNOWN, confidence: 0, fingers: null, handedness };
  }

  const states = computeFingerStates(landmarks);
  const extended = fourExtended(states, opts.minExtension);
  const extendedSet = new Set(extended);
  const thumbOpen = states.thumb.score >= 0.72;

  let gesture: Gesture = GESTURES.UNKNOWN;
  let confidence = 0;

  if (extended.length >= 4 && thumbOpen) {
    gesture = GESTURES.PAPER;
    const fingerAvg = avg(['index', 'middle', 'ring', 'pinky'].map((k) => states[k as keyof FingerStates].score));
    const thumbBoost = clamp(states.thumb.score, 0.5, 1);
    confidence = clamp(0.6 * fingerAvg + 0.4 * thumbBoost, 0, 1);
  } else if (extended.length === 0 && !thumbOpen) {
    gesture = GESTURES.ROCK;
    const curl = avg(['index', 'middle', 'ring', 'pinky'].map((k) => 1 - states[k as keyof FingerStates].score));
    const thumbCurl = 1 - clamp(states.thumb.score, 0, 0.7);
    confidence = clamp(0.7 * curl + 0.3 * thumbCurl, 0, 1);
  } else if (
    extendedSet.has('index') &&
    extendedSet.has('middle') &&
    !extendedSet.has('ring') &&
    !extendedSet.has('pinky')
  ) {
    gesture = GESTURES.SCISSORS;
    const signal = avg([states.index.score, states.middle.score]);
    const folded = avg([1 - states.ring.score, 1 - states.pinky.score]);
    confidence = clamp(0.65 * signal + 0.35 * folded, 0, 1);
  }

  if (confidence < opts.minConfidence) {
    gesture = GESTURES.UNKNOWN;
  }

  const fingers: FingerStates = { ...states };
  return {
    gesture,
    confidence: Math.round(confidence * 100) / 100,
    fingers,
    handedness,
  };
}
