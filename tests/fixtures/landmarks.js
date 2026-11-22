/**
 * landmarks.js — synthetic MediaPipe hand-landmark fixtures.
 *
 * Builds 21-point hands (x,y,z; z=0) on a canonical 2D layout so the
 * classifier can be unit-tested deterministically. Fingers are generated
 * straight or bent; whole-hand transforms (rotation/translation/scale)
 * let tests assert rotation/mirror invariance.
 */

const FINGER_IDS = {
  index: [5, 6, 7, 8],
  middle: [9, 10, 11, 12],
  ring: [13, 14, 15, 16],
  pinky: [17, 18, 19, 20],
};

// MCP position for each long finger. (0,0) is the wrist.
const MCP = {
  index: [0.9, 0.45],
  middle: [1.12, 0.45],
  ring: [1.34, 0.45],
  pinky: [1.56, 0.45],
};

const SEGMENTS = {
  index: [0.34, 0.28, 0.24],
  middle: [0.38, 0.3, 0.26],
  ring: [0.36, 0.29, 0.25],
  pinky: [0.3, 0.24, 0.2],
};

const UP = [0, -1]; // fingers point "up" away from the wrist

function rotateVec([x, y], ang) {
  const c = Math.cos(ang);
  const s = Math.sin(ang);
  return [x * c - y * s, x * s + y * c];
}

function addVec(a, b) {
  return [a[0] + b[0], a[1] + b[1]];
}

function scaleVec([x, y], k) {
  return [x * k, y * k];
}

/**
 * Render one long finger. `bent` curls it toward the palm with large
 * joint angles (low extension score).
 */
function renderFinger(key, bent, handed = 'right') {
  const [mcpX, mcpY] = MCP[key];
  const [s1, s2, s3] = SEGMENTS[key];
  const mcp = [mcpX, mcpY];
  const d1 = UP;

  // Bend direction: toward the palm center (left of the finger line).
  const bendDir = handed === 'right' ? 1 : 1;
  const pip = addVec(mcp, scaleVec(d1, s1));

  if (!bent) {
    const dip = addVec(pip, scaleVec(d1, s2));
    const tip = addVec(dip, scaleVec(d1, s3));
    return [mcp, pip, dip, tip];
  }

  const aPip = 1.75 * bendDir;
  const d2 = rotateVec(d1, aPip);
  const dip = addVec(pip, scaleVec(d2, s2));

  const aDip = 1.35;
  const d3 = rotateVec(d2, aDip);
  const tip = addVec(dip, scaleVec(d3, s3));

  return [mcp, pip, dip, tip];
}

/** Render the thumb; `open` abducts it away from the palm. */
function renderThumb(open) {
  if (open) {
    // Extended thumb reaching outward from the palm.
    return [
      [0.55, 0.3], // mcp (2)
      [0.78, 0.42], // ip (3)
      [1.02, 0.5], // tip (4)
    ];
  }
  // Tucked thumb tightly curled back toward the wrist (large IP flexion).
  return [
    [0.55, 0.3],
    [0.7, 0.22],
    [0.58, 0.14],
  ];
}

const make = (x, y) => ({ x, y, z: 0 });

/**
 * Build a full 21-landmark hand.
 * @param {object} spec { index, middle, ring, pinky, thumb, handedness }
 */
export function makeHand(spec) {
  const lms = new Array(21).fill(null).map(() => make(0, 0));

  lms[0] = make(0, 0); // wrist
  const t = spec.thumb ? renderThumb(true) : renderThumb(false);
  lms[2] = make(t[0][0], t[0][1]);
  lms[3] = make(t[1][0], t[1][1]);
  lms[4] = make(t[2][0], t[2][1]);

  for (const key of Object.keys(FINGER_IDS)) {
    const bent = !spec[key];
    const [mcp, pip, dip, tip] = renderFinger(key, bent, spec.handedness ?? 'right');
    const [i0, i1, i2, i3] = FINGER_IDS[key];
    lms[i0] = make(mcp[0], mcp[1]);
    lms[i1] = make(pip[0], pip[1]);
    lms[i2] = make(dip[0], dip[1]);
    lms[i3] = make(tip[0], tip[1]);
  }

  return lms;
}

/** Transform every landmark by a rotation/scaling about the wrist. */
export function transformHand(lms, { rotate = 0, scale = 1, dx = 0, dy = 0 } = {}) {
  return lms.map((p) => {
    const r = rotateVec([p.x, p.y], rotate);
    return make(r[0] * scale + dx, r[1] * scale + dy);
  });
}

export const HANDS = {
  paper: () => makeHand({ index: 1, middle: 1, ring: 1, pinky: 1, thumb: 1 }),
  rock: () => makeHand({ index: 0, middle: 0, ring: 0, pinky: 0, thumb: 0 }),
  scissors: () => makeHand({ index: 1, middle: 1, ring: 0, pinky: 0, thumb: 0 }),
  partial: () => makeHand({ index: 0, middle: 1, ring: 0, pinky: 0, thumb: 0 }),
  // Invalid two-finger shape: index + ring (not the scissors combo).
  invalidTwo: () => makeHand({ index: 1, middle: 0, ring: 1, pinky: 0, thumb: 0 }),
  fistWithThumbOut: () => makeHand({ index: 0, middle: 0, ring: 0, pinky: 0, thumb: 1 }),
};
