# Styling S7 — Animations & Transitions — Design

**Date:** 2026-07-03
**Status:** approved design
**Part of:** production-ready styling roadmap (S7 of S7 — final styling phase).

## Goal
A frame-driven animation engine: easing + interpolation, an `animate` driver on the host scheduler, declarative `transition` for common animatable properties, and an imperative keyframe API. Spring easing included; list FLIP deferred (documented).

## 1. Easing + interpolation (pure, `@cairn/style`)
- `packages/style/src/easing.ts`: `EasingName = 'linear'|'ease'|'ease-in'|'ease-out'|'ease-in-out'`; `easings: Record<EasingName, (t:number)=>number>`; `cubicBezier(x1,y1,x2,y2): (t)=>number` (Newton-approx); `resolveEasing(e: EasingName | ((t)=>number) | undefined): (t)=>number`.
- `packages/style/src/interpolate.ts`: `lerp(a,b,t)`; `lerpColor(a,b,t)` — parse `#rgb`/`#rrggbb`/`rgb()/rgba()` to RGBA, interpolate, return `rgba(...)`; `interpolateValue(a,b,t)` — number→lerp, color-string→lerpColor, else step (no interpolation, snap at t≥1).

## 2. Animation driver (`@cairn/runtime`)
`packages/runtime/src/animate.ts`:
```ts
export interface AnimateOptions {
  from: number; to: number; duration: number; // ms
  easing?: (t: number) => number; delay?: number;
  onUpdate: (v: number) => void; onDone?: () => void;
}
export function animate(opts: AnimateOptions): () => void; // returns cancel
```
Uses `useHost().scheduler.requestFrame(cb)` (cb gets a `timeMs`); on first tick records `start`, each tick computes `t = clamp((now - start - delay)/duration, 0, 1)`, calls `onUpdate(from + (to-from)*eased(t))`, re-requests until `t>=1` then `onDone`. Returns a cancel that sets a flag + `cancelFrame`. `onUpdate` typically sets a signal → the existing coalescing render repaints. Registers `onCleanup(cancel)` so a disposed scope stops its animations. Tested with a fake host whose scheduler synchronously invokes cb with scripted timestamps.

## 3. Declarative `transition` (`@cairn/primitives`)
`BaseStyle.transition?: TransitionConfig | TransitionConfig[]` where
```ts
export interface TransitionConfig { properties?: string[]; duration: number; easing?: EasingName | ((t:number)=>number); delay?: number }
```
(no `properties` → all animatable). Animatable props in v1: `opacity`, `backgroundColor`, `color` (numbers + colors). A `createStyleTransitions(resolved: () => BaseStyle): () => BaseStyle` helper in primitives returns an "animated" style accessor:
- Holds a signal per animatable prop (current displayed value), seeded from the first resolved value.
- A `createEffect` watches `resolved()`; when a transitioned prop's target differs from the current displayed value, it starts an `animate` (from current→target, using `interpolateValue`) whose `onUpdate` sets that prop's signal; non-transitioned props snap immediately.
- Returns `() => ({ ...resolved(), opacity: opSig(), backgroundColor: bgSig(), color: colorSig() })` (only overriding the animated props that are transitioned; others pass through).
`Box`/`Text` route their reactive style through `createStyleTransitions(resolved)` instead of raw `resolved` when a `transition` is present (cheap guard: if no `transition` in the style, use `resolved` directly — zero overhead for the common case).

## 4. Imperative keyframes + spring
- Export `animate` from `@cairn/runtime`.
- `packages/runtime/src/keyframes.ts`: `animateKeyframes(frames: { at: number; value: number }[], opts): cancel` — runs sequential `animate` tweens between successive frames (at ∈ [0,1] scaled by total duration). v1: numeric track.
- `spring`: a `spring(stiffness, damping)` easing-ish preset in easing.ts producing a `(t)=>number` approximation (or a critically-damped closed form). Keep simple; documented as approximate.
- FLIP list animation: DEFERRED (documented) — needs before/after layout capture hooks in control-flow.

## Testing
- easing: monotonic 0→1, endpoints; cubicBezier(linear params) ≈ identity.
- interpolate: lerp; lerpColor `#000`→`#fff` at 0.5 ≈ `rgba(128,128,128,1)`; interpolateValue number/color/step.
- animate: fake host scheduler feeding timestamps → onUpdate values follow eased path; onDone at end; cancel stops.
- transition: `createStyleTransitions` — changing a transitioned `opacity` target drives intermediate values (via fake scheduler); non-transitioned props pass through instantly.
- Full `pnpm test` + `pnpm typecheck` green; no `transition` → no behavior change.

## Exit criteria
- easing/interpolation, `animate` driver, declarative `transition` (opacity/color/backgroundColor), imperative `animate`/`animateKeyframes`, spring preset — all work + tested.
- Capability doc §8 rows flipped to ✅ where shipped; FLIP + full CSS keyframes noted deferred.
- One PR merged to `main`. **This completes the S1–S7 styling block.**

## Out of scope
List FLIP/reorder animation, full CSS `@keyframes` string syntax, animating layout width/height/transform declaratively (imperative `animate` can drive them via signals), interruptible spring with velocity carry-over, staggered orchestration.
