# Styling S4 — CSS Grid — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Steps use `- [ ]`.

**Goal:** CSS-Grid-subset via `GridNode` (`@cairn/layout`) + `Grid` primitive.

Design ref: `docs/superpowers/specs/2026-07-03-styling-s4-grid-design.md`.

**Tech Stack:** TypeScript, pnpm workspace, Vitest. Packages: layout, style, primitives.

---

### Task 1: Track + placement parsing
- Files: new `packages/layout/src/grid-parse.ts` (`TrackSize`, `parseTracks`, `parsePlacement`), export from `packages/layout/src/index.ts`. Test `packages/layout/test/grid-parse.test.ts`.
- `parseTracks(input)`: array passthrough; string → split on whitespace (but keep `repeat(...)` intact — tokenize by matching `repeat\([^)]*\)` OR whitespace); `<n>px`→px, `<n>fr`→fr, `auto`→auto, `repeat(count, track)`→expand.
- `parsePlacement(spec: string | number): { start?: number; end?: number; span?: number }`: number→`{start:n, span:1}`; `"a / b"` split on `/`; each side `"span n"`→span, else line number; `"span n"` alone→`{span:n}`.
- TDD: cover each token/form.

### Task 2: GridNode column/row sizing + gaps
- Files: new `packages/layout/src/grid.ts` (`GridNode` + `GridNodeProps`), export from index. Test `packages/layout/test/grid-sizing.test.ts`.
- Implement track resolution (px fixed; auto = max intrinsic of single-track items measured loosely; fr = split leftover) for columns (against maxW) and rows (px/fr-with-definite-height/content). Compute track offsets with gaps. For THIS task, place all children into explicit/simple cells is NOT required — test sizing with a fixed known placement helper (e.g., all items in row 0, one per column) so column widths can be asserted. Expose computed `colWidths`/`rowHeights`/offsets as fields for testing.
- TDD: 3×1fr over 300 width (gap 0) → [100,100,100]; `100px 1fr` over 300 → [100,200]; columnGap 10 over 3×1fr width 320 → [100,100,100] with offsets 0,110,220.

### Task 3: placement (line/span/auto-flow) + item layout + alignItems
- Files: `packages/layout/src/grid.ts` (placement + item positioning), test `packages/layout/test/grid-placement.test.ts`.
- Resolve each child's cell {colStart,colEnd,rowStart,rowEnd} from parent-data (gridColumnStart/End/Span, gridRowStart/End/Span) or auto-flow (row-major, next free cell honoring spans; grow implicit rows as auto). Add parent-data fields to `LayoutNode`: `gridColumnStart?/gridColumnEnd?/gridColumnSpan?/gridRowStart?/gridRowEnd?/gridRowSpan?/gridArea?`.
- Compute each cell rect (spanned track sizes + inner gaps); lay item out (`stretch`→tight; else loose + align within cell by justifyItems/alignItems); set offsetX/offsetY. Own size = total tracks+gaps clamped.
- TDD: auto-flow 4 items into 2 cols → positions (0,0),(1,0),(0,1),(1,1) offsets; explicit `colStart 2` places item in col 2; span 2 columns → width = 2 tracks + gap; alignItems 'start' vs 'stretch' changes item size/offset.

### Task 4: templateAreas
- Files: `packages/layout/src/grid.ts` (area name → cell region), test `packages/layout/test/grid-areas.test.ts`.
- `templateAreas: string[][]` (rows of names). Build a name→{colStart,colEnd,rowStart,rowEnd} map (min/max cell coords per name; contiguous assumed). A child with `gridArea` name gets that region. `.` = empty.
- TDD: areas `[['h','h'],['s','m']]`; item gridArea 'h' spans cols 0..2 row 0; 's' → col0 row1.

### Task 5: Grid primitive + style/child props
- Files: new `packages/primitives/src/grid.ts` (`Grid`), export from `packages/primitives/src/index.ts`; `packages/style/src/style.ts` (+`gridTemplateColumns/Rows`, `gridTemplateAreas`, `justifyItems`, `alignItems`); `packages/primitives/src/layout-child.ts` (+`gridColumn`/`gridRow`/`gridArea`, map to node parent-data). Test `packages/primitives/test/grid.test.ts`.
- `Grid({style, children})`: build `GridNode`, bind template/areas/align from resolved style (parse strings via `parseTracks`; areas: `string[]` of space-separated names → `string[][]`). Children mapped through `applyLayoutChildProps` which now parses `gridColumn`/`gridRow` via `parsePlacement` into node parent-data and sets `gridArea`.
- TDD: Grid forwards templateColumns to node; a child with `gridColumn="1 / span 2"` gets colStart/colSpan on its layout node; renders children.

### Task 6: doc flip + example + verify
- Flip `docs/styling-and-capabilities.md` §2 Grid → ✅ (note v1 subset). Update BaseStyle snapshot + primitive list (add `Grid`). Optionally add a small grid example. Full `pnpm test` + `pnpm typecheck` green.

---

## Self-review
- Coverage: parsing (T1), sizing (T2), placement+align (T3), areas (T4), primitive+props (T5), doc (T6).
- Type consistency: `TrackSize`, `parseTracks`/`parsePlacement`, GridNode fields, LayoutNode grid parent-data — consistent.
- Isolation: GridNode is a new node; no change to Flex/Box paths → existing tests unaffected.
