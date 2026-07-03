# P10-3 — ScrollView inertia (momentum) — Design

**Date:** 2026-07-03
**Status:** approved design
**Part of:** Phase 10 UI-kit roadmap (P10-3). **Virtualization is descoped** (user: out of scope for the framework for now) — this sub-phase is inertia only. Clip + scrollbar + wheel/drag already shipped (PR #22).

## Goal
Momentum/inertia scrolling: after a drag release, the ScrollView keeps scrolling with decaying velocity (a fling), clamped to bounds; grabbing again or wheeling cancels it.

## Design (in `ScrollView`, `@cairn/primitives`)
- **Velocity tracking:** during a drag (`onPointerMove`), track the scroll velocity per axis. The applied scroll delta is `-(ny - lastY)`; keep a smoothed velocity `velY = 0.7*velY + 0.3*deltaScrollY` (and X). This is per-move (~per-frame) velocity in px.
- **Fling on release:** `onPointerUp`/`onPointerLeave` — if `|vel| > START_THRESHOLD` (≈1px), start a momentum loop on `useHost().scheduler.requestFrame`. Each frame: `vel *= FRICTION` (≈0.94), `commit(read() + vel)`; stop when `|vel| < MIN_V` (≈0.4) on all active axes, or when a commit no longer changes the offset (hit a bound → zero that axis's velocity). Clamping is already in `commitX/Y`.
- **Cancellation:** `onPointerDown` (grab) and `onWheel` cancel any running momentum (`stopMomentum()`) and reset tracked velocity; `onCleanup`/teardown cancels too. Starting a new fling cancels the previous.
- Direction-aware: only fling axes the ScrollView scrolls (`scrollsX`/`scrollsY`, already computed).
- No public API change: inertia is automatic for drag. (Optional `momentum?: boolean` prop, default true, to disable — include it.)

## Testing
- Fake manual-clock host: pointerdown; a few pointermoves with a consistent delta (builds velocity); pointerup → after ticking frames, the scroll offset advances BEYOND the drag-end position (the fling) and then settles (stops requesting frames). Assert: offset after fling > offset at release, and it converges. `node.maxScrollY` set high enough not to clamp mid-fling; also test that hitting `maxScrollY` stops the fling (clamped).
- pointerdown during a fling cancels it (offset stops advancing). Wheel cancels it. `momentum: false` → no fling (offset unchanged after release).
- Existing ScrollView tests (wheel/drag/scrollbar/controlled) stay green. Full `pnpm test` + `pnpm typecheck`.

## Exit criteria
- Drag-release fling with friction + clamping + cancellation; tested.
- Live browser check: flick a list → it keeps scrolling and glides to a stop.
- Capability doc §13 ScrollView row notes inertia; §2/roadmap notes virtualization is out of scope. One PR merged.

## Out of scope
Virtualization (descoped), rubber-band/overscroll bounce, velocity from wheel, scroll-snap, nested-scroll momentum handoff.
