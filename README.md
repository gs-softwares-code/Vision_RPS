# Vision RPS

A browser-based, backend-free **Rock Paper Scissors** game played with **live hand gestures**.

- **No backend, no database, no analytics, no uploads.** Camera frames are processed entirely on-device in the browser.
- Built with **OpenCV.js** and **MediaPipe Tasks Vision (HandLandmarker)**, vanilla JavaScript ESM, and `localStorage` persistence.
- Deploys to any static host (GitHub Pages, Cloudflare Pages) as-is.

---

## Run it

Webcam access requires a **secure context** (`localhost` / HTTPS). No build step is required.

```bash
# from the project root
python -m http.server 8000
# or
npm run serve
```

Then open <http://localhost:8000>.

1. Click **Enable camera** and grant camera permission.
2. Hold your hand palm-first in front of the camera.
3. Make a **fist** for Rock, an **open palm** for Paper, or raise **index + middle** fingers for Scissors.
4. Hold the gesture steady until it locks (default 3 consecutive frames); the countdown runs automatically.

For deployment on GitHub/Cloudflare Pages: commit the repo as-is and point the host at the repository root. All asset paths are relative.

---

## Architecture

```
index.html          → app shell, import map → vendored MediaPipe bundle
src/
  app.js           → wiring: camera + vision + game + UI
  camera/
    CameraController.js  → getUserMedia lifecycle, device switch, FPS
    FrameProcessor.js    → per-frame pipeline loop (video → inference → classify)
  vision/
    geometry.js          → pure vector/landmark math
    GestureClassifier.js → rock/paper/scissors/unknown classification
    GestureStabilizer.js → temporal smoothing, locking, cooldown
    VisionEngine.js      → MediaPipe init (GPU → CPU fallback), detect, dispose
  game/
    GameEngine.js        → deterministic round state machine
    ComputerOpponent.js  → uniform-random opponent (fairness guaranteed)
    ScoreManager.js      → scores + persistence
  storage/LocalStorage.js → namespaced persistence with in-memory fallback
  ui/
    Renderer.js          → mirrored feed + skeleton overlay canvas
    Dashboard.js         → scoreboard & history DOM updates
    Settings.js          → preferences
public/
  vendor/                → vendored @mediapipe/tasks-vision@0.10.14 (mjs + wasm)
  models/hand_landmarker.task → hand model (vendored, float16)
  assets/opencv.js       → vendored OpenCV.js 4.10.0
tests/
  geometry.test.js, gestures.test.js, game.test.js  → Vitest (unit)
  e2e/app.spec.js                                     → Playwright (browser)
```

### Recognition pipeline
`Camera → Video element → MediaPipe HandLandmarker (VIDEO mode) → landmarks → GestureClassifier → GestureStabilizer → GameEngine → Dashboard`

Nothing is uploaded; the browser never leaves the device.

### Fairness
The computer's move is generated **after** the player's gesture is locked (in `GameEngine.shoot()`), and is uniformly random. There is no biased opponent.

---

## Vendored assets & offline operation

All heavy runtimes are vendored locally so the app works with no internet after first checkout:

| Asset | Version / source | Path |
|---|---|---|
| MediaPipe tasks-vision | 0.10.14 | `public/vendor/vision_bundle.mjs` |
| MediaPipe WASM (SIMD + noSIMD) | 0.10.14 | `public/vendor/wasm/` |
| Hand landmarker model | float16/1 | `public/models/hand_landmarker.task` |
| OpenCV.js | 4.10.0 | `public/assets/opencv.js` |

The VisionEngine tries a **GPU delegate** first and falls back to **CPU** automatically; it also falls back from the SIMD to the non-SIMD WASM build on older CPUs. If the local model is removed, it falls back to the official CDN URL.

> OpenCV.js is loaded and initialized but the live pipeline feeds MediaPipe directly from the video element; OpenCV is reserved for optional preprocessing and is **not** used on the hot path, so it never caps frame rate.

---

## Testing

```bash
npm install
npm test          # Vitest unit tests (geometry, gestures, game)
npm run e2e      # Playwright browser tests (mocked camera)
```

- **Unit (46 tests):** geometry primitives, finger/thumb state, rock/paper/scissors classification, rejection of invalid/partial hands, rotation invariance, stabilizer smoothing/lock/cooldown, all 9 game-rule combinations, opponent distribution, score persistence/reset.
- **Browser:** app load without critical console errors, mocked-camera pipeline initialization to “System ready”, settings interactivity and persistence, reset.

> **Manual webcam validation** of real gestures was not performed in this automated build; please validate on your hardware. The synthetic landmark fixtures in `tests/fixtures/landmarks.js` are the ground truth for the classifier.

---

## Privacy

- Frames are analysed locally, never transmitted.
- No analytics, tracking, or network calls beyond loading the vendored assets (and the model CDN fallback if the local model is absent).
- Scores/settings persist only in `localStorage`; use **Reset stats** to wipe them.

---

## Limitations

- Tracks **one hand** at a time.
- Classification is geometric (landmark geometry) — it is tuned for clear, well-lit gestures; edge lighting/occlusion may lower confidence.
- Computer opponent is uniformly random by design.

---

## License

MIT — see [LICENSE](./LICENSE).
