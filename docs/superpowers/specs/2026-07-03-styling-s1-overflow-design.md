# Styling S1 — Overflow / Clipping — Design

**Date:** 2026-07-03
**Status:** approved design
**Part of:** production-ready styling roadmap (S1 of S7).

## Goal
Add `overflow: visible | hidden | clip` to containers so a container can clip its children to its (rounded) content box. Foundational: unblocks text ellipsis (S2), image cropping, and later scroll. `overflow: scroll` is deferred to the ScrollView infra phase (clipping is the prerequisite it will build on).

## Architecture

The paint walker (`packages/runtime/src/instance.ts` `paint()`) already does `save → translate → [alpha] → paintSelf → children → restore` per node. Clipping fits cleanly: after `paintSelf` (so the node's own background/border paint unclipped) and before painting children, intersect the clip with the node's content box. The renderer already has `clipRect`; we add `clipRoundRect` so a clip respects `borderRadius` (the common "rounded image/card that crops its content" case).

### 1. Renderer — `clipRoundRect`
`@cairn/host` `Renderer` gains `clipRoundRect(rect: Rect, radii: Radii): void`. `@cairn/platform-web` implements it: `beginPath(); roundRect(x,y,w,h, normalizeRadii(radii)); clip();` (mirrors the existing `clipRect` but with a rounded path; reuse the `normalizeRadii` helper already in the renderer). `clipRect` stays for square clips.

### 2. Instance — `clipChildren`
`Instance` gains `clipChildren?: Radii | null`. When set (including `0` for a square clip), the paint walker clips the subtree to the node's box after `paintSelf`:

```ts
export function paint(inst: Instance, r: Renderer, parentAlpha = 1): void {
  r.save();
  r.translate(inst.layout.offsetX, inst.layout.offsetY);
  const alpha = /* existing opacity logic */;
  if (alpha !== parentAlpha) r.setGlobalAlpha(alpha);
  inst.paintSelf(r);
  if (inst.clipChildren !== undefined && inst.clipChildren !== null) {
    r.clipRoundRect({ x: 0, y: 0, width: inst.layout.size.w, height: inst.layout.size.h }, inst.clipChildren);
  }
  for (const child of orderByZ(inst.children)) paint(child, r, alpha);
  r.restore();
}
```
The clip is scoped by the node's own `save`/`restore`, so it doesn't leak to siblings. `clipChildren = 0` clips to a square box; a non-zero `Radii` clips to the rounded box.

### 3. Style — `overflow`
`BaseStyle` gains `overflow?: 'visible' | 'hidden' | 'clip'` (default `'visible'`). `'hidden'` and `'clip'` behave identically for painting (both crop); the distinction exists for future scroll semantics (`hidden` = clip + scrollable programmatically; `clip` = hard clip). For S1 both set the clip.

### 4. Primitive wiring
`Box` and `Flex` (Row/Column) set `instance.clipChildren` from resolved style: when `overflow` is `'hidden'` or `'clip'`, `clipChildren = borderRadius ?? 0` (so a rounded box clips to its rounded corners); otherwise leave it `undefined`. Done in the existing reactive `bind(resolved, …)` block, so it reacts to state changes.

## Hit-testing note
`hitTest` (v1) already only descends into a child when the point is inside the parent's box, so children overflowing a clipped parent are already not hit — consistent with `overflow: hidden`. `overflow: visible` children that paint outside the parent still won't be hit (pre-existing limitation), which is acceptable for S1 and documented.

## Testing
- **Renderer:** `clipRoundRect` calls `roundRect` + `clip` on the ctx (recording/mock renderer asserts the calls and the radii).
- **Paint walker:** an instance with `clipChildren = 8` emits `clipRoundRect({0,0,w,h}, 8)` after `paintSelf` and before child paints; with `clipChildren = 0` emits a square-radii clip; with `clipChildren` unset emits no clip. Clip sits inside the node's save/restore.
- **Primitives:** `Box`/`Row`/`Column` set `clipChildren` to the border radius when `overflow: 'hidden'`/`'clip'`, and leave it unset for `'visible'` (default). Reacts via the resolved-style bind.
- Full workspace `pnpm test` + `pnpm typecheck` green; existing tests unaffected (default `overflow: visible` → no clip → identical paint output).

## Exit criteria
- `overflow: hidden|clip` clips children to the rounded content box; `visible` unchanged.
- Renderer `clipRoundRect` implemented + tested.
- Capability doc: flip "overflow: hidden/clip" (§1) and "клиппинг / overflow:hidden" (§13) to ✅ (leave `overflow: scroll` ❌ → ScrollView phase).
- One PR merged to `main`.

## Out of scope
`overflow: scroll` / scrolling (ScrollView phase), overflow on arbitrary primitives beyond Box/Row/Column, hit-testing of visible-overflow children.
