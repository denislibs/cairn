# Styling S3 — Transforms + Effects — Design

**Date:** 2026-07-03
**Status:** approved design
**Part of:** production-ready styling roadmap (S3 of S7).

## Goal
2D transforms (translate/scale/rotate/skew + origin), richer shadows (multiple / spread / inset / elevation presets), canvas filters (`filter` + `backdropFilter`), and `backgroundImage` on `Box`.

## Design

### 1. Renderer — rotate + affine transform + filter
`@cairn/host` `Renderer` gains:
- `rotate(radians: number): void` → `ctx.rotate`.
- `transform(a, b, c, d, e, f): void` → `ctx.transform` (multiplies current matrix; enables skew).
- `setFilter(filter: string | null): void` → sets `ctx.filter` (`'none'` when null). Guarded (`'filter' in ctx`) for environments lacking it.
`@cairn/platform-web` implements them. (`translate`/`scale`/`save`/`restore` already exist.)

### 2. Style — transform + transformOrigin
`@cairn/style` adds:
```ts
export interface Transform {
  translateX?: number; translateY?: number;
  scale?: number; scaleX?: number; scaleY?: number;
  rotate?: number;   // degrees
  skewX?: number; skewY?: number; // degrees
}
```
`BaseStyle.transform?: Transform`, `transformOrigin?: { x: number; y: number }` (local px; default = element center). A pure `applyTransform(r, t, origin, size)` helper (in `@cairn/primitives`, reused by the walker via the instance) pivots around origin:
`translate(ox, oy); translate(tx, ty); rotate(rad); scale(sx, sy); transform(1, tan(skewY), tan(skewX), 1, 0, 0); translate(-ox, -oy)`.

### 3. Paint-walker application
`Instance` gains `transform?: Transform | null` and `transformOrigin?: { x; y } | null`. In `paint`, after `translate(offset)` + alpha and BEFORE `paintSelf`, if `transform` is set: `r.save()` is already active for the node; apply the transform ops (pivot around `transformOrigin ?? center of layout.size`). Self + children inherit it (CSS-like). No extra save needed — the node's own `save/restore` scopes it. `Box`/`Flex` set `instance.transform`/`transformOrigin` from resolved style.

### 4. Shadows — multiple / spread / inset / elevation
`Shadow` (in `@cairn/style`) gains `spread?: number` and `inset?: boolean`. `BaseStyle.boxShadow?: Shadow | Shadow[]` (accept one or many). `BaseStyle.elevation?: number` — a preset (0–24) mapped to a material-like drop shadow (a small table; elevation composes into boxShadow if boxShadow unset).
`Box.paintBox` shadow handling:
- Normalize to `Shadow[]` (from `boxShadow` and/or `elevation`).
- **Drop shadows** (`inset` falsy): for each, `save(); setShadow({...}); fill an offset/inflated rounded rect (spread inflates the rect by `spread` on all sides, radius by `spread`) with the fill; restore()`. Draw shadows BEFORE the real fill so the fill sits on top. Simplest correct approach: draw the rounded-rect shape once per drop shadow with `setShadow` active (shape color arbitrary since only the shadow shows — but to avoid the shape itself showing, offset doesn't hide it; standard trick: draw the shape with the shadow, the shape is then covered by the real fill drawn after). Draw drop shadows first, then the real fill (gradient/color) on top, then border.
- **Inset shadows** (`inset: true`): after the fill, `save(); clipRoundRect(box, radius); ` then stroke/fill an inverted shadow so it appears inside — v1 best-effort: draw a rounded-rect stroke with `setShadow` inside the clip to fake an inner shadow; if it looks poor, it's acceptable for v1 (documented). Prefer a working drop-shadow path; inset is nice-to-have.

### 5. filter + backdropFilter
`BaseStyle.filter?: string` (raw CSS filter list, e.g. `'blur(4px) brightness(1.2)'`) and `BaseStyle.backdropFilter?: string`. `Box.paintSelf`: wrap the fill/content in `setFilter(s.filter)` / reset. `backdropFilter` is applied by filtering what's already on the canvas under the box: `save(); clipRoundRect(box, radius); setFilter(backdropFilter); drawImage(canvas onto itself)?` — true backdrop filter needs re-sampling the backdrop; v1 approximation: apply `ctx.filter` to a re-draw of the current canvas region clipped to the box. This is complex; v1 supports `filter` fully and `backdropFilter` as best-effort (documented). Keep `filter` solid; `backdropFilter` may be a simpler blur approximation.

### 6. backgroundImage on Box
`BaseStyle.backgroundImage?: ImageHandle` (+ `backgroundSize?: 'cover' | 'contain' | 'fill'`, default `cover`; `backgroundPosition?` deferred → center). `Box.paintSelf`: after the background fill and before children/border, if `backgroundImage` set, `save(); clipRoundRect(box, radius); drawImage` fitted per `backgroundSize` (reuse `computeObjectFit` from `@cairn/primitives`); `restore()`.

## Testing
- Renderer: `rotate`, `transform`, `setFilter` call the ctx correctly (mock).
- `applyTransform`: emits pivot translate + ops in order for a sample transform.
- Paint walker: an instance with `transform` emits the transform ops before `paintSelf`; without, none.
- Box shadows: array → N shadowed fills; `spread` inflates; `elevation` maps to a shadow; drop shadows drawn before fill.
- Box filter: `setFilter` set+reset around content.
- Box backgroundImage: clip + drawImage fitted (assert drawImage called).
- Full `pnpm test` + `pnpm typecheck` green; defaults unchanged.

## Exit criteria
- transform/origin, multi/spread/elevation shadows, `filter`, `backgroundImage` work + tested (inset shadow & backdropFilter best-effort, documented).
- Capability doc §3/§5/§7 rows flipped to ✅ where shipped.
- One PR merged to `main`.

## Out of scope
3D transforms, per-corner independent transforms, full backdrop-filter fidelity, background-repeat/position beyond center, SVG filters.
