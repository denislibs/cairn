# @cairn/layout

DOM-free layout engine for Cairn, using the Flutter model: **constraints down, size up**.

## Nodes

- `BoxNode` — single child + padding and fixed/min/max sizing.
- `FlexNode` — `row`/`column` with `gap`, per-child `flex` (grow), `justify` (main axis),
  and `align` (cross axis, incl. `stretch`). Fills its bounded main axis by default
  (like Flutter's `mainAxisSize.max`); wraps to content when the main axis is unbounded.
- `TextNode` — single-line text; measures via the injected `LayoutContext`.
- `StackNode` — absolute positioning via each child's `left`/`top`.

## Protocol

Every node implements `layout(constraints, ctx): Size`. The parent passes `Constraints`
down; the node returns its `Size` up and sets each child's relative `offsetX`/`offsetY`.
Text measurement is injected via `LayoutContext.measureText`, so the engine has no DOM or
renderer dependency. Per-child layout hints (`flex`, `left`, `top`) live on the child node
and are interpreted by its parent.

## Example

```ts
import { FlexNode, BoxNode, TextNode } from '@cairn/layout';

const row = new FlexNode({
  direction: 'row',
  gap: 8,
  children: [
    new BoxNode({ width: 40, height: 40 }),
    new TextNode({ text: 'Hello', style: { font: '16px sans-serif' } }),
  ],
});

row.layout({ minW: 0, maxW: 320, minH: 0, maxH: 200 }, ctx);
// row.size and each child's offsetX/offsetY are now populated.
```

## Scope (v1)

Included: padding, fixed/min/max sizing, flex-grow, justify, align (incl. stretch),
absolute positioning, single-line text. Deferred to later phases: margin, flex-shrink,
wrap, multi-line/wrapped text.
