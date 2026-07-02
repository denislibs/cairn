# Cairn Bundle Phase (10b+10c+11) — Styling, Widgets & Layout — Design

**Date:** 2026-07-03
**Status:** approved design
**Depends on:** 10a (layout foundations) merged to main.
**Goal:** Flip the "cheap-to-medium" ❌/🟡 rows of `docs/styling-and-capabilities.md` to ✅ in one push — style plumbing the renderer already supports, full flex/positioning layout, and the built-in widget set.

## Scope overview

Three groups, built in order (widgets consume style + layout):

- **A — Style plumbing** (`@cairn/style`, `@cairn/host`, `@cairn/primitives`)
- **B — Layout completeness** (`@cairn/layout`, `@cairn/style`, `@cairn/primitives`)
- **C — Widgets** (`@cairn/primitives` for draw primitives, new `@cairn/widgets` for composed widgets)

Out of scope → later phases: text engine (multiline/wrap, font-split, letterSpacing, decoration, transform, ellipsis, selection), overflow/scroll, overlays/portal, animation + transform-rotate/skew, gestures, Grid, live theme/units/responsive, a11y, perf/dirty-region, routing, i18n, filter/backdropFilter, boxSizing, full SVG parser.

---

## Group A — Style plumbing

The renderer already has `setShadow`, `Gradient` (in `FillStyle`/`StrokeStyle`), `Radii = number | {tl,tr,br,bl}`, `fillRoundRect`/`strokeRoundRect`, `save`/`restore`, `clipRect`. Two renderer gaps to fill; the rest is exposing fields in `BaseStyle` and wiring them in `Box`/`Text`.

### Renderer additions (`@cairn/host`)
1. **`setGlobalAlpha(alpha: number): void`** — multiplies subsequent drawing alpha (canvas `ctx.globalAlpha`). Must be saved/restored by `save()`/`restore()` (canvas already does this). Default `1`.
2. **`setLineDash(segments: number[]): void`** — dashed/dotted strokes (canvas `ctx.setLineDash`). `[]` = solid. Saved/restored by save/restore semantics (we always wrap in save/restore where used).

Both are added to the `Renderer` interface and implemented in the web renderer (`@cairn/platform-web`). Any other renderer implementation must implement them too.

### `BaseStyle` additions (`@cairn/style`)

```ts
export interface Shadow {            // re-exported shape, matches host Shadow
  color: string; blur: number; offsetX: number; offsetY: number;
}
export type CornerRadius = number | { tl: number; tr: number; br: number; bl: number };
export type BorderSide = { width: number; color: string; style?: 'solid' | 'dashed' | 'dotted' };
export interface LinearGradient { kind: 'linear'; from: {x:number;y:number}; to: {x:number;y:number}; stops: {offset:number;color:string}[] }
export interface RadialGradient { kind: 'radial'; center: {x:number;y:number}; radius: number; stops: {offset:number;color:string}[] }
export type StyleGradient = LinearGradient | RadialGradient;

interface BaseStyle {
  // ...existing...
  minWidth?: number; maxWidth?: number; minHeight?: number; maxHeight?: number;
  borderRadius?: CornerRadius;                 // widened from number
  border?: BorderSide;                          // widened: adds optional `style`
  borderTop?: BorderSide; borderRight?: BorderSide; borderBottom?: BorderSide; borderLeft?: BorderSide;
  backgroundGradient?: StyleGradient;
  boxShadow?: Shadow;
  opacity?: number;                             // 0..1
  // text
  textShadow?: Shadow;
  textAlign?: 'left' | 'center' | 'right';
  lineHeight?: number;                          // px line box height for baseline placement
}
```

Gradient/shadow value coordinates are **local to the painted box** (origin at the box's top-left); `Box` translates them to absolute space at paint time. This keeps styles position-independent and reusable.

### Wiring
- **`Box.paintSelf`**:
  - `backgroundGradient` → fill via `FillStyle.gradient` (takes precedence over `backgroundColor`); gradient points offset by the box origin.
  - `boxShadow` → `setShadow` wrapped in `save()/restore()` around the fill only (so the border isn't double-shadowed).
  - per-corner `borderRadius` passed straight through as `Radii`.
  - `border` + per-side borders: a uniform `border` strokes the rounded rect (inset by half width, as today). If any per-side border is set, draw those sides as individual stroked lines (per-side wins over uniform on that side). `style: 'dashed'|'dotted'` sets `setLineDash` (`dashed` → `[6,4]`, `dotted` → `[2,3]` scaled by width) inside a `save()/restore()`.
- **`Text.paintSelf`**: `textAlign` → `TextStyle.align` with the x anchor chosen from the text box (`left`→x, `center`→x+w/2, `right`→x+w); `textShadow` → `setShadow` around `drawText`; `lineHeight` shifts the baseline to vertically center within the line box.
- **`opacity`**: applied by the **paint walker** (runtime), not per-primitive: before painting an instance with `style.opacity < 1`, `save()` + `setGlobalAlpha(parentAlpha * opacity)`, paint subtree, `restore()`. Nesting multiplies. Instances expose their resolved opacity to the walker (a `paintOpacity?: number` on the instance, set by primitives from resolved style).
- **min/max sizes**: `BaseStyle.minWidth/maxWidth/minHeight/maxHeight` forwarded to `BoxNode`/`FlexNode` (fields already exist on the nodes) in the same `bind()` that sets width/height.

---

## Group B — Layout completeness

### `@cairn/layout`
- **`margin`** (`number | Partial<EdgeInsets>`) as parent-data on `LayoutNode` (like `flex`/`left`/`top`). Flex/Box add each child's margin to the space it occupies: child's outer box = margin + child size; siblings are spaced by margins (margins do **not** collapse — additive, like flexbox). Cross-axis alignment aligns the outer (margin) box.
- **`rowGap`/`columnGap`** on `FlexNode`: `Row` uses `columnGap` between children (fallback to `gap`), `Column` uses `rowGap` (fallback to `gap`).
- **`alignSelf`** parent-data (`'start'|'center'|'end'|'stretch'`): overrides the container's `align` for that child on the cross axis.
- **`flexShrink`** + **`flexBasis`** on `FlexNode` children: main-axis distribution becomes: start from `flexBasis ?? content/explicit main`; distribute free space by `flex` (grow) when positive, shrink by `flexShrink` (default 1 for flex items? — **default 0** to preserve current non-shrinking behavior; only shrink when `flexShrink > 0`) when overflowing.
- **`flexWrap`** on `FlexNode` (`'nowrap' | 'wrap'`, default `'nowrap'`): when wrapping, break into lines whose main extent fits the constraint; each line sized/aligned independently on the cross axis; lines stacked on the cross axis separated by the cross gap. Grow/shrink applies per line.
- **`StackNode`**: honor **`right`/`bottom`** parent-data (position from the opposite edge; if both `left` and `right` set, they define width; same for top/bottom). `inset` is sugar for all four.
- **`zIndex`** parent-data: children painted in ascending `zIndex` (stable sort, default 0 preserves document order). Affects **paint order only**, not layout or hit-order beyond what paint order implies; hit-testing walks the same z-sorted order top-down.
- **`aspectRatio`** on `BoxNode`/`FlexNode`: when one axis is known (explicit or from constraint) and the other is unconstrained/auto, derive it as `known * (1/ratio)` appropriately (`ratio = width/height`).

### `@cairn/style` + `@cairn/primitives`
`BaseStyle` gains `margin`, `rowGap`, `columnGap`, `alignSelf`, `flexShrink`, `flexBasis`, `flexWrap`, `right`, `bottom`, `inset`, `zIndex`, `aspectRatio`. `LayoutChildProps` (the parent-data mixin) gains `margin`, `alignSelf`, `flexShrink`, `flexBasis`, `right`, `bottom`, `inset`, `zIndex`; `applyLayoutChildProps` sets them on `instance.layout`. `Row`/`Column` bind `rowGap`/`columnGap`/`flexWrap`; `Box`/`Flex` bind `aspectRatio`; `Stack` binds `right`/`bottom`/`inset`.

---

## Group C — Widgets

### Draw primitives (`@cairn/primitives`)
- **`Image`** — wraps `drawImage`. Props: `src: ImageHandle`, `width`/`height`, `objectFit?: 'fill'|'contain'|'cover'|'none'` (compute `src`/`dest` rects; default `fill`), `borderRadius?` (clip to rounded rect via `save`+`clipRect`… — v1: rectangular clip only; rounded-clip noted as a follow-up if `clipRect` is rect-only).
- **`Icon`** — vector icon from path data. Props: `path: string | Path` (SVG path `d` string parsed to a `Path`, or a prebuilt `Path`), `size` (viewBox assumed 24 unless `viewBox` given), `color`. Renders via `fillPath` scaled to `size`.
- **`Svg` / `Path`** — arbitrary path with `fill`/`stroke` (color or `StyleGradient`), `width`/`height`, `viewBox`. A minimal SVG path-`d` parser (`M L H V C S Q T A Z`, absolute + relative) lives in `@cairn/primitives` and produces a host `Path`. (Full `<svg>` document parsing stays out of scope.)

### Composed widgets (new package `@cairn/widgets`)
Each is a small function returning an `Instance`, built from `Box`/`Text`/`Stack`/primitives + reactivity, using resolved state styles (hover/pressed/focus/disabled) via the existing `createInteractive` seam. Each accepts a `style?` override and standard `EventProps`/`LayoutChildProps`.

- **`Divider`** — a thin `Box`; `orientation: 'horizontal'|'vertical'`, `thickness`, `color`, `inset`.
- **`Button`** — label (or children), `variant?: 'primary'|'secondary'|'ghost'`, `disabled`, `onClick`; centered content via Box alignX/alignY; hover/pressed/disabled state styles from theme; focusable + Enter/Space activates.
- **`Checkbox`** — controlled/uncontrolled `checked`, `onChange`, `disabled`, optional label; box + `Icon` check mark; toggle on click/Space; focusable.
- **`Switch`** — controlled/uncontrolled `value`, `onChange`, `disabled`; track + thumb (Stack + positioned thumb); toggle on click/Space; focusable.
- **`Slider`** — promote the counter example's bespoke slider: `value`, `min`, `max`, `step?`, `onChange`, `disabled`; custom-painted track/fill/handle; click-to-set + drag via `localX`; focusable + arrow keys adjust by `step`.

`@cairn/widgets` `package.json`: depends on `@cairn/reactivity`, `@cairn/layout`, `@cairn/host`, `@cairn/style`, `@cairn/primitives`, `@cairn/events`, `@cairn/runtime` (for `useHost`/context if needed). Added to the workspace + example vite aliases.

---

## Validation
- Refactor `examples/counter` to use `@cairn/widgets` `Button` + `Slider`; add a `boxShadow` + `backgroundGradient` on the card; a `Divider`; a `Checkbox` and `Switch` demonstrating state. Re-verify interactively in a browser (Playwright): clicks, drag, keyboard toggle, focus ring.
- After merge, flip every implemented row in `docs/styling-and-capabilities.md` to ✅ (and update the "current set" snapshot + primitive inventory).

## Testing (per group)
- **A:** style types accept new fields; `Box` paints gradient/shadow/per-corner/per-side+dashed borders (assert renderer calls via a mock/recording renderer); `Text` applies align/textShadow/lineHeight; renderer `setGlobalAlpha`/`setLineDash` implemented; paint walker multiplies nested opacity; min/max forwarded to nodes.
- **B:** margin spacing + cross-align of outer box; row/columnGap selection by direction; alignSelf overrides align; flexBasis/grow/shrink distribution (grow splits free space, shrink only when `flexShrink>0`); flexWrap breaks lines and stacks them; Stack right/bottom/inset positioning incl. left+right→width; zIndex paint+hit order; aspectRatio derivation.
- **C:** SVG path parser (each command, abs+rel, sample paths); Image objectFit rect math; Icon/Path render via fillPath; each widget: default render, state style resolution, controlled/uncontrolled, keyboard activation, disabled blocks interaction.
- Full workspace `pnpm typecheck` + `pnpm vitest run` green; existing tests stay green.

## Exit criteria
- All Group A/B/C items implemented, tested, green across the workspace.
- Counter example renders with widgets + shadow/gradient; manual browser check passes.
- `docs/styling-and-capabilities.md` rows flipped to ✅ for everything shipped.
- One PR (`phase-10b-styling-widgets-layout`) merged to `main`.
