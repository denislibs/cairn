# AN4 — FLIP list animations — Design

**Date:** 2026-07-03
**Status:** approved design
**Part of:** Animations v2 + SVG roadmap (AN4).

## Goal
Smoothly animate keyed `For` list items to their new positions when the list reorders/adds/removes — the FLIP technique (First, Last, Invert, Play).

## Background
`For` reconciles keyed children and reorders `instance.children`/`layout.children` in its effect; the new positions are only known after the next layout pass (in `mount`'s `renderFrame`). FLIP needs: capture each surviving child's position BEFORE the reorder, and AFTER the next layout compute the delta, jump each moved child back to its old spot (invert) via a transform, then animate the transform to identity (play).

## 1. Post-layout hook (`@cairn/runtime`)
`scheduler.ts` gains a one-shot after-layout queue:
```ts
export function onNextLayout(cb: () => void): void; // queue a callback to run once, right after the next layout
export function flushAfterLayout(): void;           // run + clear the queue (called by mount)
```
`onNextLayout` pushes `cb` and `scheduleFrame()`. `mount`'s `renderFrame`, after laying out the root (+ overlays) and BEFORE `paint`, calls `flushAfterLayout()` — so callbacks see final offsets and can set transforms that the same frame paints.

## 2. `For` FLIP option
`ForProps` gains `flip?: boolean | { duration?: number; easing?; spring?: {...} }` (default off; `true` = default 250ms ease-out). When enabled, in the reconcile effect:
- **First:** before `apply(ordered)`, snapshot each SURVIVING entry's current relative offset `{ x: inst.layout.offsetX, y: inst.layout.offsetY }` (from the last frame's layout) into `prev[key]`.
- reorder + `apply(ordered)` (schedules a frame).
- **Last/Invert/Play:** `onNextLayout(() => { for each surviving key: const now = {x:offsetX,y:offsetY}; const dx = prev.x - now.x, dy = prev.y - now.y; if (dx || dy) { inst.transform = { translateX: dx, translateY: dy }; animate/spring the transform to { translateX:0, translateY:0 } via interpolateValue, onUpdate sets inst.transform, scheduleFrame; } })`. Uses `animate` (or `animateSpring`) from runtime. New items (no prev) don't FLIP (they can be wrapped in `Presence` for enter — out of scope here).
- Transforms are set directly on the child `Instance.transform` (the paint walker applies it). Documented assumption: FLIP children don't also drive `transform` via their own style.
- Track per-key in-flight FLIP cancels; cancel a running FLIP for a key before starting a new one (rapid reorders).

## 3. Offsets are relative to the For container
All `For` children share the same `FlexNode` parent, so relative `offsetX/offsetY` deltas are correct for the move (the container itself doesn't move between the two states within one reorder).

## Testing
- runtime post-layout hook: `onNextLayout(cb)` runs `cb` exactly once after `flushAfterLayout()`, then the queue is empty (a second flush doesn't re-run it).
- `For` FLIP (fake manual-clock host): build a `For` with keys `[a,b,c]`, run an initial layout (assign offsets manually or via a real Flex layout with a fake ctx), reorder to `[c,a,b]`, then simulate the frame: after `apply`+layout the surviving items get a non-identity `transform` set (invert), and driving the clock animates each `transform` toward `{translateX:0,translateY:0}`. Assert: a moved child has `transform` set to the inverted delta right after `flushAfterLayout`, and after driving the clock its transform settles to ~0. (Positions can be set on the layout nodes directly in the test to control deltas deterministically.)
- Non-flip `For` unchanged. Full `pnpm test` + `pnpm typecheck` green.

## Exit criteria
- `For` with `flip` animates item moves on reorder; post-layout hook in place; tested.
- Live browser check: a keyed list whose items smoothly slide to new positions on shuffle/remove.
- Capability doc §8 FLIP row → ✅. One PR merged.

## Out of scope
Enter/exit of list items (use `Presence` per item — AN3; combined For+Presence orchestration is AN5), size-change FLIP (scale), shared-element transitions, cross-container FLIP.
