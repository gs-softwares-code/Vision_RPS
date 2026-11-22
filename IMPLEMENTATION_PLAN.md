# Vision RPS 2.0 — Implementation Plan

Based on `docs/INITIAL_AUDIT.md`. Each phase ends with verification (tests/build) before the next begins.

## Phase 1 — Architecture Modernization (TypeScript + Vite)
- Add Vite, TypeScript, and toolchain. Keep vanilla-ESM architecture (no framework).
- Port existing `src/**/*.js` → `.ts` with types; keep all 46 unit tests green.
- Organize into domains (app, camera, vision, game, player, history, analytics, storage, settings, pwa, components).
- Add `vite.config.ts`, `tsconfig.json`.

## Phase 2 — UI/UX Redesign
- Premium esports dashboard (dark graphite, violet/cyan, glass, Lucide icons).
- Navigation sidebar: Dashboard, Play, History, Statistics, Profile, Achievements, Training Lab, Settings.
- Reusable components (StatCard, Modal, Toast, Chart, Sidebar, Header).
- Responsive + accessibility (semantic, focus, reduced-motion).

## Phase 3 — Player Profile System
- Multiple local profiles (UUID, username, avatar, level, XP, streaks, favourite move).
- Create/edit/switch/delete/reset-with-confirmation.
- XP + level calc, titles, rewards, duplicate-prevention.

## Phase 4 — Match History & Data Management
- Match + Round data model (Dexie/IndexedDB). Relational integrity.
- History dashboard: filter by date/result/mode, sort, pagination, match-detail modal.
- Export/import JSON+CSV with schema validation, preview, duplicate detection.

## Phase 5 — Statistics & Analytics
- Real-record metrics: totals, win %, streaks, favourite/most-successful move, mode distribution, daily/weekly activity.
- Chart.js charts (win/loss/draw, win-rate trend, activity, move distribution, mode usage).

## Phase 6 — Game Engine Expansion
- Explicit state machine; modes: Classic, Best-of-3, Best-of-5, Practice, Speed, Survival, Daily Challenge.
- One-gesture-one-round enforcement; pause/resume/restart; camera/visibility transitions.

## Phase 7 — Computer Opponent Intelligence
- Random (fair default), Adaptive, Predictive, Challenge bots. Labeled, no peak, independent tests.

## Phase 8 — Computer Vision Hardening
- Hand-selection policy (two hands), invalid-gesture feedback, centralized tunable config, visibility pause, leak hygiene, performance targets.

## Phase 9 — Vision Training Lab
- Live feed + metrics (hands, handedness, finger states, gesture, confidence, stability, latency, FPS, resolution).
- Practice exercises + calibration workflow. No footage/landmark transmission.

## Phase 10 — Achievements & Gamification
- Achievement engine (id, name, description, icon, condition, reward, timestamp, progress), prompt, notifications, gallery.

## Phase 11 — Settings & Personalization
- Camera, vision, gameplay, appearance (dark/light/accent/reduced-motion), privacy/data controls. Persist.

## Phase 12 — Local Database Architecture
- Dexie DB: profiles, matches, rounds, achievements, player_achievements, settings, progression.
- Versioning, migrations, indexes, referential consistency, transactional writes.

## Phase 13 — PWA & Offline
- Manifest, icons, service worker, offline shell, versioned cache, update notification, first-visit vs offline testing.

## Phase 14 — Security & Privacy
- CSP + security headers, safe DOM, import validation, no eval, dep audit, pinning.
- `docs/PRIVACY.md`, `docs/SECURITY.md`.

## Phase 15 — Testing & QA
- Unit + integration + e2e expansion; synthetic fixtures (rotations, left/right, low-confidence, multi-hand).
- No critical console errors, no uncaught rejections, no duplicate rounds, no broken navigation.

## Phase 16 — Performance
- Measure; lazy-load non-essential pages; load vision on demand; optimize frame path, DOM, charts, DB queries.

## Phase 17 — Cloudflare Pages Deployment
- Vite static build config; deployment docs; CI (install→typecheck→unit→build→e2e); no untested auto-deploy.

## Phase 18 — Final Validation
- Full functional + visual + deployment checklists → `docs/TESTING.md`.
