# Cairn Phase 3 — Layout engine (`@cairn/layout`) — Design

**Date:** 2026-07-02
**Status:** approved design
**Depends on:** Phase 1 (`@cairn/reactivity`) and Phase 2 (`@cairn/host`, for `TextStyle`/`TextMeasurement`/`Rect` types) — both merged to main.

## Goal

A DOM-free layout engine using the Flutter model — **constraints down, size up** — with OO
node classes. Covers Box, Flex (row/column), Text, and Stack (absolute), enough for the
majority of real UI.

## Decisions

| Area | Decision |
|---|---|
| Node representation | OO classes with a `layout(constraints, ctx)` method; mutable `size`/`offset` cache the result |
| Text measurement | Injected via `LayoutContext.measureText` passed to `layout()` — layout core never touches a Renderer directly |
| Coordinates | Relative offset (`offsetX`/`offsetY` set by the parent); absolute coords accumulated later at paint/hit-test |
| Parent-data | `flex` / `left` / `top` are optional fields on the child node, interpreted by the parent (pragmatic Flutter-style parentData) |
| v1 scope | Box (padding + fixed/min/max sizing), Flex (row/column, gap, flex-grow, justify + align), Text (single-line, measured), Stack (absolute via left/top) |
| Package | `@cairn/layout`, DOM-free (`lib: ["ES2022"]`) |

## Core protocol (`src/types.ts`, `src/node.ts`)

```ts
interface Constraints { minW: number; maxW: number; minH: number; maxH: number; }
interface Size { w: number; h: number; }
interface LayoutContext {
  measureText(text: string, style: TextStyle): TextMeasurement; // from @cairn/host
}

abstract class LayoutNode {
  children: LayoutNode[] = [];
  size: Size = { w: 0, h: 0 };
  offsetX = 0; // relative to parent, set by the parent during its layout()
  offsetY = 0;
  flex = 0; // parent-data: FlexNode distributes free main-axis space by this
  left?: number; // parent-data: StackNode positions by these
  top?: number;
  // constraints down / size up: returns own size, sets children's offsets.
  abstract layout(c: Constraints, ctx: LayoutContext): Size;
}
```

Helpers (module-level or static): `clamp(value, min, max)`, `tight(w, h)` → Constraints,
`looseFrom(c)` → Constraints with min 0.

## Nodes

### BoxNode (`src/box.ts`)
Props: `padding` (per-side or uniform), optional `width`/`height`/`minWidth`/`maxWidth`/
`minHeight`/`maxHeight`. Single child (`children[0]`, optional).
- Resolve own constraints from incoming constraints + explicit sizing props (clamped).
- Deflate by padding, lay out the child with the deflated constraints.
- Own size = explicit size if given, else child size + padding, clamped to incoming constraints.
- Child offset = `(padding.left, padding.top)`.
- No child: size to explicit size or the constraint min.

### FlexNode (`src/flex.ts`)
Props: `direction: 'row' | 'column'`, `gap`, `justify: 'start'|'center'|'end'|'space-between'|'space-around'`,
`align: 'start'|'center'|'end'|'stretch'`. Reads each `child.flex`.
- Phase 1: lay out non-flex children (`flex === 0`) with loose main-axis / cross constraints
  (cross tight to container cross when `align === 'stretch'`). Accumulate main extent + gaps.
- Phase 2: distribute remaining main-axis space among flex children proportionally to `flex`,
  each given a **tight** main-axis extent (its share) and the cross constraint.
- Position children along the main axis per `justify`; align on the cross axis per `align`.
- Own size: main = incoming main max (if bounded) or content extent; cross = max child cross
  (or tight cross if constrained).

### TextNode (`src/text.ts`)
Props: `text: string`, `style: TextStyle`. Leaf. Single-line (no wrapping in v1).
- `layout`: `const m = ctx.measureText(text, style)`; `w = min(maxW, m.width)` clamped to min;
  `h` = line height derived from the style (font size) — clamped to constraints.
- No children.

### StackNode (`src/stack.ts`)
Props: none beyond children (each child may carry `left`/`top`). Absolute positioning / overlays.
- Lay out each child with loose constraints (up to the stack's max).
- Child offset = `(child.left ?? 0, child.top ?? 0)`.
- Own size = incoming max if bounded, else the bounding box of positioned children.

## Data flow

Single pass: `root.layout(rootConstraints, ctx)` — constraints flow down, sizes flow up, each
node sets `offsetX`/`offsetY` on its children. Results are a mutable cache (`size`, `offset`)
on the nodes, which Phase 4 will invalidate reactively. No absolute coordinates are stored;
paint/hit-test accumulate them via `translate` (Phase 4/6).

## Testing

Snapshot-style coordinate tests with a **deterministic fake `measureText`**
(e.g. `w = text.length * fontSize * 0.6`, `h = fontSize`). Build reference trees and assert each
node's `size`, `offsetX`, `offsetY`:
- nested Box + padding sizing
- Row with mixed fixed + flex children, gap, each `justify` mode
- Column with `align: 'stretch'` and cross alignment modes
- Text clamped to a max width; height from style
- Stack with absolute `left`/`top`
- Edge cases: empty Box, zero children Flex, flex with zero free space

## Exit criteria

- `@cairn/layout` builds DOM-free; `pnpm typecheck` + `pnpm vitest run` green.
- All node types implement the `layout` protocol with snapshot-tested coordinates.
- Single pass down/up; Flex two-phase for flex children.

## Out of scope (later phases)

- margin, flex-shrink, wrap (Phase 10/11)
- multi-line / wrapped text (Phase 10)
- reactive binding, dirty-tracking, and paint (Phase 4)
- hit-testing (Phase 6)
