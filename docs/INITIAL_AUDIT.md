# Vision RPS 2.0 — Initial Repository Audit

Date: 2026-11-22
Scope: full audit of the existing Vision RPS 1.0 project before upgrade.

## 1. Existing architecture

The project is a **backend-free, static, front-end-only** browser app:

| Layer | Technology |
|---|---|
| Language | Vanilla JavaScript (ESM), no build step |
| Serving | `python -m http.server 8000` (dev), static files |
| Vision | MediaPipe Tasks Vision `HandLandmarker` (VIDEO mode) via vendored ESM bundle |
| WASM | Vendored: `vision_wasm_internal.{js,wasm}` + non-SIMD variants |
| Model | Vendored `hand_landmarker.task` (local override → CDN fallback) |
| Image processing | OpenCV.js vendored but **not used in the runtime path** |
| Persistence | `localStorage` (namespaced `vision-rps:`) with in-memory fallback |
| UI | Hand-built DOM updates (no framework) |
| Unit tests | Vitest 5 (node env), 46 tests across geometry/gestures/game |
| Browser tests | Playwright 1.65, mocked camera (`canvas.captureStream(20)`), 3 specs |

Module map (existing, all `.js`):

```
src/
  app.js                    bootstrap + wiring (camera+vision+game+UI)
  camera/CameraController.js webcam lifecycle, enumerate, switch, stop, FPS
  camera/FrameProcessor.js   rAF loop, guarded inference, stability, render
  vision/VisionEngine.js     MediaPipe init (GPU→CPU fallback), dispose
  vision/GestureClassifier.js classify(landmarks, handedness) → {gesture,confidence,fingers}
  vision/GestureStabilizer.js temporal smoothing, lock, cooldown
  vision/geometry.js         pure vector/angle/extension helpers
  game/GameEngine.js         deterministic state machine (idle→countdown→revealed)
  game/ComputerOpponent.js   uniform random, injectable RNG
  game/ScoreManager.js       win/loss/draw aggregate + persistence
  storage/LocalStorage.js    namespaced wrapper + memory fallback
  ui/Renderer.js             mirrored feed + skeleton overlay + gesture badge
  ui/Dashboard.js            scoreboard/history DOM updates
  ui/Settings.js             defaults + localStorage load/save
  styles/main.css            dark vign glassmorphism
```

## 2. Functional baseline (verified)

- App loads without critical console errors (Playwright e2e).
- Camera+vision pipeline boots to "System ready" using **local** WASM + model (confirmed via server logs: `200 /public/vendor/wasm/vision_wasm_internal.js|wasm`, `200 /public/models/hand_landmarker.task`).
- Gesture classification (rock/paper/scissors), geometry, game rules, scoring, opponent distribution, stabilization — all covered by 46 passing unit tests.
- Settings persist across reload; camera reset works; zero critical console errors.

## 3. Broken / missing / weak areas

### Correctness / robustness
- **No player identity.** Single implicit profile; no profiles, no per-profile stats.
- **No match/round persistence model.** `ScoreManager` stores only four aggregate counters; rounds are ephemeral (server-rendered history list only, capped at 12 rows, lost on reload).
- **Single game mode** (endless classic). No best-of-3/5, practice, speed, survival, daily challenge.
- **Single opponent** (uniform random). No adaptive/predictive/challenge personalities.
- **Single-hand only used** — `detectForVideo` reads `landmarks[0]`, `numHands` default 1; no hand-selection policy when two hands are visible.
- **No invalid-gesture feedback path** distinct from "unknown" (UI shows "—" only).
- **Countdown lifecycle** lives in `app.js` via nested `setTimeout`; not a state machine, fragile to stop/restart (a disabled app mid-countdown still fires callbacks).
- **No pause/resume/visibility handling.** When the tab is hidden, the rAF loop keeps running (wasted inference), and `visibilitychange` is not used to stop camera/inference.
- **Renderer** allocates per-frame strings/new objects; `_fit` recomputes; acceptable but not optimized. Canvas uses `element.width` backing-store re-layout.
- **No memory-leak verification** e.g. OpenCV Mats (OpenCV not in runtime path, so low risk today but unverified if reintroduced).

### UI / product
- Single-page layout: playfield + side panels. No navigation, dashboard, profile, history page, analytics, achievements, training lab, settings page.
- **Emoji icons** (`✊ ✋ ✌️ ▣`) — project mandates Lucide.
- No responsive sidebar; desktop-first only (camera occupies lots of space on mobile).
- No accessibility pass (focus states, `aria`, reduced motion).
- No PWA (no manifest, no service worker, no offline shell).
- No Chart.js analytics (no charts at all).
- No Toast/empty-state/error components.

### Persistence
- `localStorage` only. No IndexedDB, no per-profile tables, no match/round repositories, no migrations, no import/export, no transaction guarantees.
- Existing `vision-rps:score` aggregate is incompatible with the new relational model — needs migration (the prompt forbids silently discarding existing data).

### Security / privacy
- No CSP headers, no security headers (static server). No `docs/PRIVACY.md` / `docs/SECURITY.md`.
- `appendHistory` uses `innerHTML` with interpolated strings (time, moves, result) — moves/result are constrained by the classifier, so injection risk is low, but should use safe DOM construction or escaping.
- No input validation for future JSON/CSV import.

### Build / deployment
- No build tool — raw ESM + import map. Good for simplicity, insufficient for TS, PWA, bundling, asset hashing.
- No TypeScript anywhere.
- No `vite.config`, no `tsconfig`, no `manifest.webmanifest`, no service worker.
- No CI/CD.
- No deployment docs; serving is Python dev server only.

## 4. Technical debt

- Monolithic `app.js` (~305 lines) mixes bootstrap, wiring, countdown, audio, settings side-effects.
- Magic thresholds scattered (geometry/classifier/stabilizer defaults) — not centralized in a tunable config.
- Countdown + result reveal use `setTimeout` chains; no cancellation token.
- No central events; everything is direct method calls / callbacks.
- Tests are pure-logic only; no integration tests for the full gesture→round→persist loop.

## 5. Performance considerations (target: i7-8650U, iGPU, 16GB)

- Inference guarded against overlap (good). FPS tracked (good).
- Model is float16 (~7–8 MB); loaded once. WASM vendored locally (no network).
- Per-frame work is small (single detection + light geometry). On iGPU, **CPU delegate** is the realistic default; GPU attempt with CPU fallback is already correct.
- No per-frame canvas allocation of source images (uses video element directly) — good.

## 6. Security review (current)

- No secrets in repository (verified). No network egress except CDN-model fallback (local model present, so offline).
- Camera frames never leave the device — confirmed by architecture (no upload code path).
- `innerHTML` usage limited to history rows; low risk, but will switch to safe construction.
- No `eval`/dynamic code execution found.

## 7. Recommended changes (prioritized)

| # | Change | Phase |
|---|---|---|
| 1 | Migrate to **TypeScript + Vite** build (foundation for everything else). | 1 |
| 2 | Introduce **IndexedDB (Dexie)** relational persistence: profiles, matches, rounds, achievements, progression. | 1, 12 |
| 3 | **Player profile system**: identity, XP, levels, titles, multiple local profiles, avatar. | 3 |
| 4 | **Match/round data model + history page** with filter/search/pagination, export/import (JSON/CSV). | 4 |
| 5 | **Analytics dashboard** with Chart.js, computed from real records. | 5 |
| 6 | **Game engine expansion**: modes (classic, best-of-3/5, practice, speed, survival, daily), explicit state machine. | 6 |
| 7 | **Opponent personalities**: random, adaptive, predictive, challenge (labeled, fair). | 7 |
| 8 | **Vision hardening**: selection policy, invalid-gesture feedback, config-centralization, visibility pause, leak hygiene. | 8 |
| 9 | **Training Lab** (practice + calibration). | 9 |
| 10 | **Achievements + progression engine.** | 10 |
| 11 | **Settings/personalization page** (camera, vision, gameplay, appearance, privacy/data). | 11 |
| 12 | **PWA**: manifest, service worker, offline shell, safe caching. | 13 |
| 13 | **Security/privacy docs + CSP + safe DOM** + import validation. | 14 |
| 14 | **Testing expansion**: unit + integration + e2e, synthetic gesture fixtures across rotations/hands. | 15 |
| 15 | **Performance optimization** incl. lazy loading of non-essential pages. | 16 |
| 16 | **Cloudflare Pages build config + CI + deployment docs.** | 17 |
| 17 | Full product validation + docs + status report. | 18 |

## 8. Initial order of execution

1. Phase 1 foundation: Vite + TS + configs, keep all 46 unit tests green (port modules to TS).
2. Phase 12 DB layer early (it is a dependency of profiles/history/analytics/achievements).
3. Then product layers (3→11) in the numbered order, each verified.
4. PWA, security, performance, deployment, validation.
