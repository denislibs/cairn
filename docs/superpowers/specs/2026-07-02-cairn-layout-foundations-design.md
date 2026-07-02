# Cairn Phase 10a — Layout & Style Foundations — Design

**Date:** 2026-07-02
**Status:** approved design
**Depends on:** layout, style, primitives, runtime — all merged to main.
**Milestone:** completes the layout engine so widgets (10b) build cleanly; removes the counter/todo workarounds.

## Goal

Expose and complete the layout capabilities the engine mostly already has: sized flex
containers, Box child alignment, flex-grow, absolute positioning (`Stack`), and borders. This
kills the `Column>Row` centering hack and the explicit-size workarounds, and unblocks 10b widgets.

Discovery: `StackNode` already exists; `LayoutNode` already carries `flex`/`left`/`top` parent-data;
the renderer already has `strokeRoundRect`. So most of this is *exposing* existing engine power.

## 1. Sized flex containers — `FlexNode` width/height

`FlexNode` currently ignores size. Add `width?: number` / `height?: number` fields.
In `layout()`, an explicit size overrides the computed own-size on that axis:
`ownMain = explicitMain ?? (mainAxisSize === 'min' ? clamp(contentMain, minMain, mainMax) : fill/content)`,
clamped to the axis constraints; `ownCross = explicitCross ?? (existing cross logic)`. Children still
receive the container's inner extents. `Flex` primitive binds `layout.width`/`height` from
`style.width`/`style.height` (in the same `bind(resolved, ...)` that sets gap/justify/align).

## 2. Box child alignment — `BoxNode.alignX`/`alignY`

`BoxNode` places its child at `(padding.left, padding.top)`. Add `alignX?` / `alignY?`
(`'start' | 'center' | 'end'`, default `'start'`). After the child is laid out and the box's own
size computed, position the child within the content box:
- available extra X = `(w - p.left - p.right) - childW` (clamped `>= 0`);
  `offsetX = p.left + (alignX==='center' ? extra/2 : alignX==='end' ? extra : 0)`; same for Y.
- Default `'start'` reproduces current behavior.

`BaseStyle` gains `alignX?` / `alignY?` (`Align`-like: `'start'|'center'|'end'`). `Box` forwards
them to the `BoxNode`. → `Box{ width, height, alignX:'center', alignY:'center' } > Text` centers a
label (replaces the `Column>Row` nesting).

## 3. flex-grow — shared `flex` child prop

The engine already distributes free main-axis space to children with `flex > 0` (Phase 3). Expose a
`flex?: number` prop that sets `instance.layout.flex`. → a wide `+` button is `flex={1}` inside a Row.

## 4. Absolute positioning — `Stack` primitive + `left`/`top`

New `Stack` primitive (in `@cairn/primitives`) wrapping `StackNode` (children placed at their
`left`/`top`). Shared `left?` / `top?` child props set `instance.layout.left` / `top`.
`Stack` accepts `style` (width/height/background/borderRadius via a wrapping... — see below) and
`children`. → overlays, badges, custom widget internals.

Note: `StackNode` has no background/padding of its own. For a Stack with a background, wrap it in a
`Box`. The `Stack` primitive itself is a bare positioning container (like `Row`/`Column`).

## 5. Borders — `BaseStyle.border`

`BaseStyle` gains `border?: { width: number; color: string }`. `Box.paintSelf` draws the border
after the fill: `strokeRoundRect({ x: w/2-inset..., }, borderRadius, { color, width })` inset by
half the stroke width so the stroke sits inside the box edge (crisp). Applies with or without a
`backgroundColor`.

## Shared child props — `LayoutChildProps`

`flex` / `left` / `top` are parent-data (meaningful inside Flex/Stack). Bundle into a
`LayoutChildProps { flex?: number; left?: number; top?: number }` mixin added to `Box`/`Text`/`Flex`
props (alongside `EventProps`). A small `applyLayoutChildProps(instance, props)` sets
`instance.layout.flex/left/top` when provided. Applied in each primitive before returning.

## Primitive wiring summary

- `Box`: `alignX`/`alignY` + `border` (paint) from style; `LayoutChildProps`.
- `Text`: `LayoutChildProps`.
- `Row`/`Column` (`Flex`): `width`/`height` from style; `LayoutChildProps`.
- New `Stack`: bare `StackNode` container; `children`; `LayoutChildProps`.

## Validation

Refactor `examples/counter`:
- Button label centered via Box `alignX/alignY` (remove the `Column>Row` nesting).
- `+` button grows via `flex={1}` in the button Row (instead of a hardcoded 252 width).
- `−`/reset buttons get a subtle `border`.
Confirms the workarounds are gone and the primitives compose cleanly. Re-verify in a browser.

## Testing

- **FlexNode:** explicit `width`/`height` override computed size (with and without `mainAxisSize:'min'`); children still laid out inside.
- **BoxNode:** `alignX`/`alignY` = `center`/`end` offset the child correctly when the box is larger than the child; `start` unchanged.
- **primitives:** `Box` forwards `alignX`/`alignY` to the node and paints a border stroke when `style.border` is set; `flex` prop sets `layout.flex` and a flex child grows in a Row (two `flex:1` children split width); `Row`/`Column` size from `style.width`/`height`; `left`/`top` position a child inside a `Stack`.
- Existing layout/primitive/example tests stay green.

## Exit criteria

- Sized containers, Box child alignment, flex-grow, `Stack` + positioning, and borders all work.
- `pnpm typecheck` + `pnpm vitest run` green across the workspace.
- Counter refactor renders correctly with the workarounds removed (manual browser check).

## Out of scope (→ 10b / later)

- Widgets (Button/Slider/Checkbox/Switch/Image/Icon/Divider) — Phase 10b.
- `text-align` on `Text` (workaround: wrap in a `Box{ alignX }`); per-side borders / per-corner radius;
  grid; scroll views; `Stack` with intrinsic background (wrap in a `Box`).
