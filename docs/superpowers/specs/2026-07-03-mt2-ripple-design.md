# MT2 — Ripple + interaction core — Design

**Date:** 2026-07-03
**Status:** approved design
**Part of:** Material kit roadmap (MT2). Original implementation of the Material Design touch-ripple + state-layer interaction pattern.

## Goal
The signature Material press feedback: a translucent circle that expands from the pointer and fades, clipped to the surface. Plus state-layer overlays (hover/focus/pressed) and elevation-transition usage. These power MT3+ components.

## 1. `Ripple` (`@cairn/material`)
A component you place inside an interactive surface (which must clip — `overflow:'hidden'`). It fills the parent and, on `trigger(x, y)`, spawns an expanding+fading circle.
```ts
export interface RippleHandle { instance: Instance; trigger(x: number, y: number): void; }
export function createRipple(opts?: { color?: string; duration?: number }): RippleHandle;
```
- Internals: a signal `ripples: { id; x; y; p: () => number }[]`. `trigger(x,y)`: add a ripple, `animate({ from:0, to:1, duration≈450, easing:'ease-out', onUpdate: setP, onDone: remove })` (uses `@cairn/runtime` `animate`).
- `instance`: a `Box`-like raw Instance filling the parent (width/height `'100%'`), `paintSelf(r)` — for each ripple: `save(); clipRoundRect({0,0,w,h}, borderRadius); ` draw a filled circle via `fillRoundRect({ x:cx-R, y:cy-R, width:2R, height:2R }, R, { color: alpha(color, 0.3*(1-p)) })` where `R = maxRadius * p`, `maxRadius` = distance from (x,y) to the farthest corner (computed from the paint-time size). `restore()`. Color defaults to `currentColor`-ish — pass a color (usually the text/contrast color at low alpha).
- Uses `useHost` via `animate`; `onCleanup` cancels in-flight ripple animations.
- Clipping: the ripple self-clips in paintSelf so it stays within the surface even if the parent didn't set overflow.

## 2. State-layer helper
Material state layers = a translucent overlay of the "on-surface"/content color at a per-state opacity. Pure helper:
```ts
export function stateLayerOpacity(state: 'hover' | 'focus' | 'pressed' | 'dragged' | 'none'): number;
// hover 0.04, focus 0.12, pressed 0.12 (baseline values)
export function stateOverlay(color: string, state): string; // alpha(color, stateLayerOpacity(state)) or 'transparent'
```
Components blend this over the base background per current interactive state (from `createInteractive`).

## 3. Elevation transitions
No new code: components animate `boxShadow` between `theme.elevation[a]` and `theme.elevation[b]` on hover/press using the existing `transition` (AN1 animates `boxShadow`). MT2 documents the pattern; MT3 buttons use it.

## Testing
- `stateLayerOpacity`/`stateOverlay`: correct per-state values; `none` → transparent/0.
- `createRipple`: `trigger(x,y)` adds a ripple (paint draws a `fillRoundRect` circle via a recording renderer after trigger); the ripple animates (progress advances under a fake clock) and is removed on completion (no `fillRoundRect` after done). Before any trigger, paint draws nothing.
- Package builds + typechecks. (Ripple visual correctness is confirmed live.)

## Exit criteria
- `createRipple` + state-layer helpers implemented + tested; exported from `@cairn/material`.
- Live browser check: a demo surface where clicking spawns a ripple that expands from the click point and fades.
- One PR merged.

## Out of scope
Ripple centered/unbounded variants (only bounded-from-pointer for v1), focus/keyboard-triggered ripple, per-ripple color from theme automatically (caller passes color), Material 3 state-layer tokens.
