# Styling S4 — CSS Grid — Design

**Date:** 2026-07-03
**Status:** approved design
**Part of:** production-ready styling roadmap (S4 of S7).

## Goal
A CSS-Grid-subset layout: `GridNode` in `@cairn/layout` + a `Grid` primitive. Columns/rows as `px | fr | auto | repeat()`, gaps, item placement by line/span and named areas, and item alignment.

## Track model
```ts
export type TrackSize =
  | { kind: 'px'; value: number }
  | { kind: 'fr'; value: number }
  | { kind: 'auto' };
```
`parseTracks(input: string | TrackSize[]): TrackSize[]` — accepts an array as-is, or parses a string:
- tokens separated by whitespace: `100px` → px, `2fr` → fr, `1fr`→fr(1), `auto` → auto.
- `repeat(3, 1fr)` expands to three `fr(1)`; `repeat(2, 100px)` → two px(100). (Nested repeat / auto-fill deferred.)
Pure + unit-tested.

## Placement model
Children carry parent-data:
- `gridColumnStart?`, `gridColumnEnd?`, `gridRowStart?`, `gridRowEnd?` (1-based line numbers), and `gridColumnSpan?`, `gridRowSpan?`.
- `gridArea?: string` (name from `templateAreas`).
`parsePlacement(spec: string)` parses CSS-ish `gridColumn`/`gridRow` strings: `"1 / 3"` → start 1, end 3; `"2 / span 2"` → start 2, span 2; `"span 3"` → span 3 (auto start); `"2"` → start 2, span 1. The `Grid` primitive maps `gridColumn`/`gridRow`/`gridArea` child props onto the node's parent-data.

## GridNode
Fields: `templateColumns: TrackSize[]`, `templateRows: TrackSize[]`, `rowGap`, `columnGap`, `templateAreas?: string[][]` (parsed grid of area names, `.`/`'none'` = empty), `justifyItems`/`alignItems` (`'start'|'center'|'end'|'stretch'`, default `stretch`). Children are `LayoutNode`s with the grid parent-data above.

### layout(c, ctx)
1. **Auto-placement:** assign every child a cell region `{ colStart, colEnd, rowStart, rowEnd }` (0-based half-open, resolved from explicit line/span, `gridArea` lookup in `templateAreas`, or auto-flow row-major into the next free cells — respecting item spans). If `templateRows` is shorter than needed, implicit rows are added as `auto`.
2. **Column sizing** against `availW = maxW`:
   - Fixed: `px` tracks take their value.
   - `auto`: size to max intrinsic width of single-column items in that track (measure each such child with a loose constraint; multi-track items don't contribute to a single auto track in v1).
   - `fr`: split `max(0, availW - fixed - autos - columnGaps)` by fr weight.
   - Column offsets = cumulative widths + gaps.
3. **Row sizing** against `availH = maxH`:
   - `px` rows fixed; `fr` rows split leftover ONLY when `availH` is finite (definite height), else treated as content; `auto`/content rows = max item height in that row (after laying items out at their column width).
   - Implicit rows are content-sized.
4. **Item layout + placement:** for each child, compute its cell rect (sum of spanned track sizes + inner gaps). Lay the child out: `stretch` → tight cell size on that axis; else loose, then position within the cell by `justifyItems` (X) / `alignItems` (Y) (`alignSelf`/`justifySelf` per-item override supported via existing `alignSelf` for cross? — v1: use grid-level items alignment; per-item `justifySelf`/`alignSelf` deferred). Set child `offsetX/offsetY`.
5. **Own size:** width = sum column widths + gaps (clamped to constraints); height = sum row heights + gaps (clamped).

## Grid primitive (`@cairn/primitives`)
`Grid({ style, children })` wrapping `GridNode`. Style fields (on `BaseStyle`): `gridTemplateColumns?: string | TrackSize[]`, `gridTemplateRows?`, `gridTemplateAreas?: string[]` (each string a row, space-separated names), `justifyItems?`, `alignItems?` (grid uses the existing `justify`/`align`? no — add dedicated `justifyItems`/`alignItems`). Child props (on `LayoutChildProps`): `gridColumn?: string | number`, `gridRow?: string | number`, `gridArea?: string`, mapped via `applyLayoutChildProps` into the node's grid parent-data fields (add them to `LayoutNode`).

## Testing
- `parseTracks`: px/fr/auto, repeat expansion, array passthrough.
- `parsePlacement`: `"1/3"`, `"2 / span 2"`, `"span 3"`, `"2"`.
- `GridNode`: 3×`1fr` splits width equally; px+fr mix; gaps; span across 2 columns; auto-flow places sequential items; explicit line placement; templateAreas maps a named item to the right cell; content-sized rows; alignItems stretch vs start.
- `Grid` primitive: forwards template/areas + child gridColumn/gridRow/gridArea to the node; renders children at computed offsets.
- Full `pnpm test` + `pnpm typecheck` green.

## Exit criteria
- Columns/rows (px/fr/auto/repeat), gaps, line/span placement, named areas, auto-flow, item alignment all work + tested.
- Capability doc §2 "Grid" row → ✅ (note the v1 subset: no minmax/auto-fill/content-alignment/subgrid).
- One PR merged to `main`.

## Out of scope (v1)
`minmax()`, `auto-fill`/`auto-fit`, `justifyContent`/`alignContent` (track distribution), per-item `justifySelf`/`alignSelf`, subgrid, negative line numbers, dense packing.
