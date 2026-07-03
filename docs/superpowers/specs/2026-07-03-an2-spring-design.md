# AN2 — Real spring + interruptible driver — Design

**Date:** 2026-07-03
**Status:** approved design
**Part of:** Animations v2 + SVG roadmap (AN2).

## Goal
Replace the S7 t-normalized `spring()` easing with a real physics spring driver (stiffness/damping/mass, duration-less), and make transitions interruptible with **velocity carry-over** — retargeting mid-flight continues from the current position AND velocity, so motion never snaps.

## Current state
`animate({from,to,duration,easing})` is time+easing based. `spring()` in `@cairn/style` is an analytic approximation used as an easing curve — no real physics, no velocity. `createStyleTransitions` runs `animate({from:0,to:1,duration,easing})` and cancels+restarts on retarget (position continuous, velocity lost).

## 1. Spring integrator (`@cairn/runtime`)
`animateSpring(opts): { cancel: () => void; velocity: () => number }`:
```ts
export interface SpringOptions {
  from: number; to: number;
  stiffness?: number;  // default 170
  damping?: number;    // default 26
  mass?: number;       // default 1
  initialVelocity?: number; // for carry-over
  restDelta?: number;  // default 0.01 (settle displacement)
  restSpeed?: number;  // default 0.05 (settle velocity)
  onUpdate: (v: number) => void;
  onDone?: () => void;
}
```
Per frame (dt = (now-last)/1000, clamped ≤ 1/30 to stay stable), semi-implicit Euler:
`a = (-k*(x - to) - c*v)/m; v += a*dt; x += v*dt`. Settle when `|x-to| < restDelta && |v| < restSpeed` → `onUpdate(to)`, `onDone`. Uses `useHost().scheduler.requestFrame` (timestamped); `onCleanup(cancel)`. `velocity()` returns the current `v` (for carry-over).

## 2. Spring in transitions (`@cairn/style` + `@cairn/primitives`)
`TransitionConfig` gains `spring?: { stiffness?: number; damping?: number; mass?: number }`. When `spring` is set, `duration`/`easing` are ignored. `createStyleTransitions`:
- For a spring-configured prop, drive **progress** 0→1 with `animateSpring` (springs overshoot past 1 — natural), `onUpdate: (p) => set(interpolateValue(fromVal, toVal, p))`.
- **Velocity carry-over:** track each prop's current spring handle; on retarget, read `handle.velocity()`, cancel it, and start the new spring with `initialVelocity` = that velocity and `from: 0` (from = current displayed value, to = new target). Progress-space velocity carries continuity for the common scalar case (documented approximation for structured props).
- Non-spring (time) transitions keep the existing `animate` path unchanged.

## 3. Keep `spring()` easing
Leave the analytic `spring()` easing in `@cairn/style` (still usable as an easing for time-based transitions), but the real physics path is `animateSpring` + `TransitionConfig.spring`.

## Testing
- `animateSpring` (fake manual-clock host, scripted timestamps): converges from→to; overshoots then settles for low damping; calls `onDone` once at rest; `velocity()` non-zero mid-flight, ~0 at rest; `initialVelocity` affects the trajectory; cancel stops.
- `createStyleTransitions` with `spring`: a spring-configured `opacity`/`width` moves toward target across ticks and settles; retarget mid-flight carries velocity (new spring's first steps reflect prior motion — assert velocity() was read / continuity, e.g. value keeps moving in the prior direction briefly).
- Time transitions unchanged (S7 + AN1 tests green). Full `pnpm test` + `pnpm typecheck` green.

## Exit criteria
- `animateSpring` physics driver + `TransitionConfig.spring` with velocity carry-over, tested.
- Live browser check: a spring toggle that, when interrupted mid-flight, continues smoothly (no snap).
- Capability doc §8 spring row updated (real physics + interruptible). One PR merged.

## Out of scope
Per-scalar value-space springs for structured props (progress-space is v1), spring on the imperative `animate` public API beyond what transitions need (can add `animateSpring` export for manual use), 2D/vector springs, decay/inertia animations (AN6 value drivers / gestures).
