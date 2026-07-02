# @cairn/layout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build Cairn's DOM-free layout engine (`@cairn/layout`) using the Flutter model — constraints down, size up — with OO node classes: `BoxNode`, `FlexNode`, `TextNode`, `StackNode`.

**Architecture:** Each node extends an abstract `LayoutNode` and implements `layout(constraints, ctx): Size`, returning its own size (size up) and setting each child's relative `offsetX`/`offsetY` (parent positions children). Text measurement is injected via `LayoutContext.measureText`, so the engine never depends on a real Renderer and is unit-testable with a deterministic fake. `flex`/`left`/`top` are parent-interpreted fields on the child node.

**Tech Stack:** TypeScript (strict, `lib: ES2022`, no DOM), pnpm workspaces, Vitest. Depends on `@cairn/host` for `TextStyle`/`TextMeasurement` types only.

---

## File Structure

```
package.json                       # MODIFY: typecheck script adds layout
packages/layout/
  package.json                     # @cairn/layout, dep @cairn/host
  tsconfig.json                    # extends base (no DOM lib)
  src/
    types.ts                       # Constraints, Size, LayoutContext + clamp/resolveAxis helpers
    node.ts                        # abstract LayoutNode base
    text.ts                        # TextNode (leaf, measures)
    box.ts                         # BoxNode (padding + sizing, single child)
    flex.ts                        # FlexNode (row/column, gap, flex, justify, align)
    stack.ts                       # StackNode (absolute via left/top)
    index.ts                       # barrel
  test/
    fake-measure.ts                # deterministic LayoutContext for tests
    node.test.ts
    text.test.ts
    box.test.ts
    flex.test.ts
    stack.test.ts
```

Each file has one responsibility (one node type). `flex.ts` is the largest (two-phase flex).

---

## Task 1: Scaffold + core types + LayoutNode base

**Files:**
- Create: `packages/layout/package.json`
- Create: `packages/layout/tsconfig.json`
- Create: `packages/layout/src/types.ts`
- Create: `packages/layout/src/node.ts`
- Create: `packages/layout/src/index.ts`
- Modify: `package.json` (root typecheck)
- Test: `packages/layout/test/node.test.ts`

- [ ] **Step 1: Write the failing test**

`packages/layout/test/node.test.ts`:
```ts
import { test, expect } from 'vitest';
import { LayoutNode, clamp, resolveAxis } from '../src/index';

class StubNode extends LayoutNode {
  layout() {
    this.size = { w: 1, h: 2 };
    return this.size;
  }
}

test('LayoutNode has default fields', () => {
  const n = new StubNode();
  expect(n.children).toEqual([]);
  expect(n.size).toEqual({ w: 0, h: 0 });
  expect(n.offsetX).toBe(0);
  expect(n.offsetY).toBe(0);
  expect(n.flex).toBe(0);
  expect(n.left).toBeUndefined();
  expect(n.top).toBeUndefined();
});

test('clamp constrains a value to a range', () => {
  expect(clamp(5, 0, 10)).toBe(5);
  expect(clamp(-1, 0, 10)).toBe(0);
  expect(clamp(11, 0, 10)).toBe(10);
});

test('resolveAxis: no props returns incoming range', () => {
  expect(resolveAxis(0, 100)).toEqual([0, 100]);
});

test('resolveAxis: exact size pins both ends (clamped to incoming)', () => {
  expect(resolveAxis(0, 100, 40)).toEqual([40, 40]);
  expect(resolveAxis(0, 30, 40)).toEqual([30, 30]); // clamped to incoming max
});

test('resolveAxis: min/max props tighten within incoming', () => {
  expect(resolveAxis(0, 100, undefined, 20, 80)).toEqual([20, 80]);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run packages/layout/test/node.test.ts`
Expected: FAIL — cannot resolve `../src/index`.

- [ ] **Step 3: Create the package files**

`packages/layout/package.json`:
```json
{
  "name": "@cairn/layout",
  "version": "0.0.0",
  "type": "module",
  "main": "./src/index.ts",
  "module": "./src/index.ts",
  "types": "./src/index.ts",
  "exports": {
    ".": "./src/index.ts"
  },
  "sideEffects": false,
  "dependencies": {
    "@cairn/host": "workspace:*"
  }
}
```

`packages/layout/tsconfig.json`:
```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist"
  },
  "include": ["src", "test"]
}
```

`packages/layout/src/types.ts`:
```ts
import type { TextStyle, TextMeasurement } from '@cairn/host';

export interface Constraints {
  minW: number;
  maxW: number;
  minH: number;
  maxH: number;
}

export interface Size {
  w: number;
  h: number;
}

export interface LayoutContext {
  measureText(text: string, style: TextStyle): TextMeasurement;
}

export function clamp(value: number, min: number, max: number): number {
  return value < min ? min : value > max ? max : value;
}

// Resolve one axis (min,max) given incoming constraints and optional sizing props.
// exact pins both ends; min/max tighten. Everything is clamped to the incoming range.
export function resolveAxis(
  cMin: number,
  cMax: number,
  exact?: number,
  min?: number,
  max?: number,
): [number, number] {
  let lo = exact ?? min ?? cMin;
  let hi = exact ?? max ?? cMax;
  lo = clamp(lo, cMin, cMax);
  hi = clamp(hi, cMin, cMax);
  if (lo > hi) lo = hi;
  return [lo, hi];
}
```

`packages/layout/src/node.ts`:
```ts
import type { Constraints, Size, LayoutContext } from './types';

export abstract class LayoutNode {
  children: LayoutNode[] = [];
  size: Size = { w: 0, h: 0 };
  offsetX = 0; // relative to parent; set by the parent during its layout()
  offsetY = 0;
  flex = 0; // parent-data: FlexNode distributes free main-axis space by this
  left?: number; // parent-data: StackNode positions by these
  top?: number;

  // constraints down / size up: returns own size, sets children's offsets.
  abstract layout(c: Constraints, ctx: LayoutContext): Size;
}
```

`packages/layout/src/index.ts`:
```ts
export type { Constraints, Size, LayoutContext } from './types';
export { clamp, resolveAxis } from './types';
export { LayoutNode } from './node';
```

- [ ] **Step 4: Update the root typecheck script + install**

Modify root `package.json` `scripts.typecheck` to:
```json
    "typecheck": "tsc --noEmit -p packages/reactivity/tsconfig.json && tsc --noEmit -p packages/host/tsconfig.json && tsc --noEmit -p packages/platform-web/tsconfig.json && tsc --noEmit -p packages/layout/tsconfig.json"
```

Run: `pnpm install`
Expected: no errors; `@cairn/host` symlinked into `@cairn/layout`.

- [ ] **Step 5: Run test + typecheck**

Run: `pnpm vitest run packages/layout/test/node.test.ts`
Expected: PASS (5 tests).

Run: `pnpm typecheck`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(layout): scaffold @cairn/layout with core types and LayoutNode base"
```

---

## Task 2: TextNode + deterministic fake measurer

**Files:**
- Create: `packages/layout/src/text.ts`
- Create: `packages/layout/test/fake-measure.ts`
- Modify: `packages/layout/src/index.ts`
- Test: `packages/layout/test/text.test.ts`

- [ ] **Step 1: Write the fake measurer + failing test**

`packages/layout/test/fake-measure.ts`:
```ts
import type { LayoutContext } from '../src/index';

// Deterministic text measurement for tests: width scales with length and font size.
export function fakeMeasure(): LayoutContext {
  return {
    measureText(text, style) {
      const m = style.font.match(/(\d+(?:\.\d+)?)px/);
      const fontSize = m ? parseFloat(m[1]) : 16;
      return { width: text.length * fontSize * 0.6 };
    },
  };
}
```

`packages/layout/test/text.test.ts`:
```ts
import { test, expect } from 'vitest';
import { TextNode } from '../src/index';
import { fakeMeasure } from './fake-measure';

const LOOSE = { minW: 0, maxW: 1000, minH: 0, maxH: 1000 };

test('TextNode measures width from context and height from font size', () => {
  const t = new TextNode({ text: 'hello', style: { font: '20px sans-serif' } });
  const size = t.layout(LOOSE, fakeMeasure());
  expect(size).toEqual({ w: 5 * 20 * 0.6, h: 20 }); // 60 x 20
  expect(t.size).toEqual({ w: 60, h: 20 });
});

test('TextNode clamps width to the max constraint', () => {
  const t = new TextNode({ text: 'hello', style: { font: '20px sans-serif' } });
  const size = t.layout({ minW: 0, maxW: 40, minH: 0, maxH: 1000 }, fakeMeasure());
  expect(size.w).toBe(40); // measured 60, clamped to 40
  expect(size.h).toBe(20);
});

test('TextNode explicit lineHeight overrides font-derived height', () => {
  const t = new TextNode({ text: 'hi', style: { font: '16px sans-serif' }, lineHeight: 24 });
  const size = t.layout(LOOSE, fakeMeasure());
  expect(size.h).toBe(24);
});

test('TextNode defaults font size to 16 when the font has no px value', () => {
  const t = new TextNode({ text: 'hi', style: { font: 'bold sans-serif' } });
  const size = t.layout(LOOSE, fakeMeasure());
  expect(size.h).toBe(16);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run packages/layout/test/text.test.ts`
Expected: FAIL — `TextNode` not exported.

- [ ] **Step 3: Implement text.ts and export it**

`packages/layout/src/text.ts`:
```ts
import type { TextStyle } from '@cairn/host';
import { LayoutNode } from './node';
import { type Constraints, type Size, type LayoutContext, clamp } from './types';

export interface TextNodeProps {
  text: string;
  style: TextStyle;
  lineHeight?: number;
}

// Extract the pixel font size from a CSS font shorthand, defaulting to 16.
function fontSize(font: string): number {
  const m = font.match(/(\d+(?:\.\d+)?)px/);
  return m ? parseFloat(m[1]) : 16;
}

export class TextNode extends LayoutNode {
  text: string;
  style: TextStyle;
  lineHeight?: number;

  constructor(props: TextNodeProps) {
    super();
    this.text = props.text;
    this.style = props.style;
    this.lineHeight = props.lineHeight;
  }

  layout(c: Constraints, ctx: LayoutContext): Size {
    const measured = ctx.measureText(this.text, this.style);
    const w = clamp(Math.min(measured.width, c.maxW), c.minW, c.maxW);
    const h = clamp(this.lineHeight ?? fontSize(this.style.font), c.minH, c.maxH);
    this.size = { w, h };
    return this.size;
  }
}
```

`packages/layout/src/index.ts` (replace with):
```ts
export type { Constraints, Size, LayoutContext } from './types';
export { clamp, resolveAxis } from './types';
export { LayoutNode } from './node';
export { TextNode } from './text';
export type { TextNodeProps } from './text';
```

- [ ] **Step 4: Run test + typecheck**

Run: `pnpm vitest run packages/layout/test/text.test.ts`
Expected: PASS (4 tests).

Run: `pnpm typecheck`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(layout): TextNode (single-line, measured via LayoutContext)"
```

---

## Task 3: BoxNode

**Files:**
- Create: `packages/layout/src/box.ts`
- Modify: `packages/layout/src/index.ts`
- Test: `packages/layout/test/box.test.ts`

- [ ] **Step 1: Write the failing test**

`packages/layout/test/box.test.ts`:
```ts
import { test, expect } from 'vitest';
import { BoxNode, TextNode } from '../src/index';
import { fakeMeasure } from './fake-measure';

const LOOSE = { minW: 0, maxW: 1000, minH: 0, maxH: 1000 };

test('BoxNode wraps a child with uniform padding', () => {
  const child = new TextNode({ text: 'hi', style: { font: '10px sans-serif' } }); // 2*10*0.6=12 x 10
  const box = new BoxNode({ padding: 5, child });
  const size = box.layout(LOOSE, fakeMeasure());
  expect(size).toEqual({ w: 12 + 10, h: 10 + 10 }); // child + 5 each side
  expect(child.offsetX).toBe(5);
  expect(child.offsetY).toBe(5);
});

test('BoxNode per-side padding', () => {
  const child = new TextNode({ text: 'x', style: { font: '10px sans-serif' } }); // 6 x 10
  const box = new BoxNode({ padding: { top: 1, right: 2, bottom: 3, left: 4 }, child });
  const size = box.layout(LOOSE, fakeMeasure());
  expect(size).toEqual({ w: 6 + 2 + 4, h: 10 + 1 + 3 });
  expect(child.offsetX).toBe(4);
  expect(child.offsetY).toBe(1);
});

test('BoxNode explicit width/height override content size', () => {
  const child = new TextNode({ text: 'x', style: { font: '10px sans-serif' } });
  const box = new BoxNode({ width: 100, height: 50, child });
  const size = box.layout(LOOSE, fakeMeasure());
  expect(size).toEqual({ w: 100, h: 50 });
});

test('BoxNode deflates child constraints by padding', () => {
  const child = new TextNode({ text: 'wide text here', style: { font: '10px sans-serif' } });
  // parent maxW 50, padding 10 each side -> child maxW 30 -> width clamped to 30
  const box = new BoxNode({ padding: 10, child });
  box.layout({ minW: 0, maxW: 50, minH: 0, maxH: 1000 }, fakeMeasure());
  expect(child.size.w).toBe(30);
});

test('BoxNode with no child sizes to the constraint minimum', () => {
  const box = new BoxNode({});
  const size = box.layout({ minW: 7, maxW: 100, minH: 3, maxH: 100 }, fakeMeasure());
  expect(size).toEqual({ w: 7, h: 3 });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run packages/layout/test/box.test.ts`
Expected: FAIL — `BoxNode` not exported.

- [ ] **Step 3: Implement box.ts and export it**

`packages/layout/src/box.ts`:
```ts
import { LayoutNode } from './node';
import { type Constraints, type Size, type LayoutContext, clamp, resolveAxis } from './types';

export interface EdgeInsets {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export interface BoxNodeProps {
  padding?: number | Partial<EdgeInsets>;
  width?: number;
  height?: number;
  minWidth?: number;
  maxWidth?: number;
  minHeight?: number;
  maxHeight?: number;
  child?: LayoutNode;
}

function toInsets(p?: number | Partial<EdgeInsets>): EdgeInsets {
  if (p == null) return { top: 0, right: 0, bottom: 0, left: 0 };
  if (typeof p === 'number') return { top: p, right: p, bottom: p, left: p };
  return { top: p.top ?? 0, right: p.right ?? 0, bottom: p.bottom ?? 0, left: p.left ?? 0 };
}

export class BoxNode extends LayoutNode {
  padding: EdgeInsets;
  width?: number;
  height?: number;
  minWidth?: number;
  maxWidth?: number;
  minHeight?: number;
  maxHeight?: number;

  constructor(props: BoxNodeProps = {}) {
    super();
    this.padding = toInsets(props.padding);
    this.width = props.width;
    this.height = props.height;
    this.minWidth = props.minWidth;
    this.maxWidth = props.maxWidth;
    this.minHeight = props.minHeight;
    this.maxHeight = props.maxHeight;
    if (props.child) this.children = [props.child];
  }

  layout(c: Constraints, ctx: LayoutContext): Size {
    const [selfMinW, selfMaxW] = resolveAxis(c.minW, c.maxW, this.width, this.minWidth, this.maxWidth);
    const [selfMinH, selfMaxH] = resolveAxis(c.minH, c.maxH, this.height, this.minHeight, this.maxHeight);
    const p = this.padding;
    const child = this.children[0];

    let w: number;
    let h: number;
    if (child) {
      const childMaxW = Math.max(0, selfMaxW - p.left - p.right);
      const childMaxH = Math.max(0, selfMaxH - p.top - p.bottom);
      const cs = child.layout({ minW: 0, maxW: childMaxW, minH: 0, maxH: childMaxH }, ctx);
      child.offsetX = p.left;
      child.offsetY = p.top;
      w = clamp(cs.w + p.left + p.right, selfMinW, selfMaxW);
      h = clamp(cs.h + p.top + p.bottom, selfMinH, selfMaxH);
    } else {
      w = selfMinW;
      h = selfMinH;
    }
    this.size = { w, h };
    return this.size;
  }
}
```

`packages/layout/src/index.ts` (append these two lines):
```ts
export { BoxNode } from './box';
export type { BoxNodeProps, EdgeInsets } from './box';
```

- [ ] **Step 4: Run test + typecheck**

Run: `pnpm vitest run packages/layout/test/box.test.ts`
Expected: PASS (5 tests).

Run: `pnpm typecheck`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(layout): BoxNode (padding + fixed/min/max sizing, single child)"
```

---

## Task 4: FlexNode (row/column, gap, flex-grow, justify, align)

**Files:**
- Create: `packages/layout/src/flex.ts`
- Modify: `packages/layout/src/index.ts`
- Test: `packages/layout/test/flex.test.ts`

- [ ] **Step 1: Write the failing test**

`packages/layout/test/flex.test.ts`:
```ts
import { test, expect } from 'vitest';
import { FlexNode, BoxNode } from '../src/index';
import { fakeMeasure } from './fake-measure';

const ctx = fakeMeasure();
// helper: a fixed-size leaf via BoxNode with explicit width/height
const box = (w: number, h: number, flex = 0) => {
  const b = new BoxNode({ width: w, height: h });
  b.flex = flex;
  return b;
};

test('row lays children left to right with gap', () => {
  const a = box(10, 20);
  const b = box(30, 40);
  const row = new FlexNode({ direction: 'row', gap: 5, children: [a, b] });
  const size = row.layout({ minW: 0, maxW: 200, minH: 0, maxH: 200 }, ctx);
  expect(a.offsetX).toBe(0);
  expect(b.offsetX).toBe(15); // 10 + gap 5
  expect(size.h).toBe(40); // max cross
});

test('column lays children top to bottom with gap', () => {
  const a = box(10, 20);
  const b = box(30, 40);
  const col = new FlexNode({ direction: 'column', gap: 5, children: [a, b] });
  col.layout({ minW: 0, maxW: 200, minH: 0, maxH: 200 }, ctx);
  expect(a.offsetY).toBe(0);
  expect(b.offsetY).toBe(25); // 20 + gap 5
});

test('flex-grow distributes remaining main-axis space proportionally', () => {
  const fixed = box(20, 10);
  const g1 = box(0, 10, 1);
  const g2 = box(0, 10, 3);
  const row = new FlexNode({ direction: 'row', children: [fixed, g1, g2] });
  row.layout({ minW: 0, maxW: 120, minH: 0, maxH: 100 }, ctx);
  // free = 120 - 20 = 100; g1 gets 25, g2 gets 75
  expect(g1.size.w).toBe(25);
  expect(g2.size.w).toBe(75);
  expect(fixed.offsetX).toBe(0);
  expect(g1.offsetX).toBe(20);
  expect(g2.offsetX).toBe(45); // 20 + 25
});

test('justify: end pushes content to the far edge', () => {
  const a = box(10, 10);
  const b = box(20, 10);
  const row = new FlexNode({ direction: 'row', justify: 'end', children: [a, b] });
  row.layout({ minW: 0, maxW: 100, minH: 0, maxH: 100 }, ctx);
  // content = 30, free = 70; start at 70
  expect(a.offsetX).toBe(70);
  expect(b.offsetX).toBe(80);
});

test('justify: center centers content', () => {
  const a = box(10, 10);
  const b = box(20, 10);
  const row = new FlexNode({ direction: 'row', justify: 'center', children: [a, b] });
  row.layout({ minW: 0, maxW: 100, minH: 0, maxH: 100 }, ctx);
  expect(a.offsetX).toBe(35); // free 70 / 2
  expect(b.offsetX).toBe(45);
});

test('justify: space-between spreads gaps evenly', () => {
  const a = box(10, 10);
  const b = box(10, 10);
  const c = box(10, 10);
  const row = new FlexNode({ direction: 'row', justify: 'space-between', children: [a, b, c] });
  row.layout({ minW: 0, maxW: 100, minH: 0, maxH: 100 }, ctx);
  // content 30, free 70, 2 gaps of 35
  expect(a.offsetX).toBe(0);
  expect(b.offsetX).toBe(45); // 10 + 35
  expect(c.offsetX).toBe(90); // 45 + 10 + 35
});

test('align: center centers children on the cross axis', () => {
  const a = box(10, 20);
  const b = box(10, 40);
  const row = new FlexNode({ direction: 'row', align: 'center', children: [a, b] });
  const size = row.layout({ minW: 0, maxW: 100, minH: 0, maxH: 100 }, ctx);
  expect(size.h).toBe(40); // tallest child
  expect(a.offsetY).toBe(10); // (40 - 20) / 2
  expect(b.offsetY).toBe(0);
});

test('align: stretch makes children fill the cross axis', () => {
  const a = box(10, 20);
  const row = new FlexNode({ direction: 'row', align: 'stretch', children: [a] });
  row.layout({ minW: 0, maxW: 100, minH: 0, maxH: 60 }, ctx);
  expect(a.size.h).toBe(60); // stretched to container cross (bounded maxH)
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run packages/layout/test/flex.test.ts`
Expected: FAIL — `FlexNode` not exported.

- [ ] **Step 3: Implement flex.ts and export it**

`packages/layout/src/flex.ts`:
```ts
import { LayoutNode } from './node';
import { type Constraints, type Size, type LayoutContext, clamp } from './types';

export type FlexDirection = 'row' | 'column';
export type Justify = 'start' | 'center' | 'end' | 'space-between' | 'space-around';
export type Align = 'start' | 'center' | 'end' | 'stretch';

export interface FlexNodeProps {
  direction?: FlexDirection;
  gap?: number;
  justify?: Justify;
  align?: Align;
  children?: LayoutNode[];
}

export class FlexNode extends LayoutNode {
  direction: FlexDirection;
  gap: number;
  justify: Justify;
  align: Align;

  constructor(props: FlexNodeProps = {}) {
    super();
    this.direction = props.direction ?? 'row';
    this.gap = props.gap ?? 0;
    this.justify = props.justify ?? 'start';
    this.align = props.align ?? 'start';
    this.children = props.children ?? [];
  }

  layout(c: Constraints, ctx: LayoutContext): Size {
    const isRow = this.direction === 'row';
    const mainMax = isRow ? c.maxW : c.maxH;
    const crossMax = isRow ? c.maxH : c.maxW;
    const n = this.children.length;
    const gapTotal = this.gap * Math.max(0, n - 1);

    const mainSize = (s: Size): number => (isRow ? s.w : s.h);
    const crossSize = (s: Size): number => (isRow ? s.h : s.w);
    const crossRange = (): [number, number] =>
      this.align === 'stretch' && isFinite(crossMax) ? [crossMax, crossMax] : [0, crossMax];
    const make = (mainLo: number, mainHi: number, crossLo: number, crossHi: number): Constraints =>
      isRow
        ? { minW: mainLo, maxW: mainHi, minH: crossLo, maxH: crossHi }
        : { minW: crossLo, maxW: crossHi, minH: mainLo, maxH: mainHi };

    // Phase 1: non-flex children get loose main + align-driven cross constraints.
    let usedMain = gapTotal;
    let maxCross = 0;
    const flexChildren: LayoutNode[] = [];
    let totalFlex = 0;
    for (const ch of this.children) {
      if (ch.flex > 0) {
        flexChildren.push(ch);
        totalFlex += ch.flex;
        continue;
      }
      const [clo, chi] = crossRange();
      const s = ch.layout(make(0, mainMax, clo, chi), ctx);
      usedMain += mainSize(s);
      maxCross = Math.max(maxCross, crossSize(s));
    }

    // Phase 2: flex children split the remaining main-axis space (tight main extent).
    const free = Math.max(0, (isFinite(mainMax) ? mainMax : usedMain) - usedMain);
    for (const ch of flexChildren) {
      const share = totalFlex > 0 ? (free * ch.flex) / totalFlex : 0;
      const [clo, chi] = crossRange();
      const s = ch.layout(make(share, share, clo, chi), ctx);
      maxCross = Math.max(maxCross, crossSize(s));
    }

    // Own size.
    const contentMain = this.children.reduce((sum, ch) => sum + mainSize(ch.size), 0) + gapTotal;
    const ownMain = isFinite(mainMax) ? mainMax : contentMain;
    const ownCross =
      this.align === 'stretch' && isFinite(crossMax)
        ? crossMax
        : clamp(maxCross, isRow ? c.minH : c.minW, crossMax);

    // Position along the main axis per justify.
    const freeMain = Math.max(0, ownMain - contentMain);
    let cursor = 0;
    let between = this.gap;
    switch (this.justify) {
      case 'start':
        cursor = 0;
        break;
      case 'center':
        cursor = freeMain / 2;
        break;
      case 'end':
        cursor = freeMain;
        break;
      case 'space-between':
        cursor = 0;
        between = this.gap + (n > 1 ? freeMain / (n - 1) : 0);
        break;
      case 'space-around': {
        const around = n > 0 ? freeMain / n : 0;
        cursor = around / 2;
        between = this.gap + around;
        break;
      }
    }

    // Place each child: main via cursor, cross via align.
    for (const ch of this.children) {
      const cs = crossSize(ch.size);
      let crossOffset = 0;
      if (this.align === 'center') crossOffset = (ownCross - cs) / 2;
      else if (this.align === 'end') crossOffset = ownCross - cs;
      // 'start' and 'stretch' -> 0

      if (isRow) {
        ch.offsetX = cursor;
        ch.offsetY = crossOffset;
      } else {
        ch.offsetX = crossOffset;
        ch.offsetY = cursor;
      }
      cursor += mainSize(ch.size) + between;
    }

    this.size = isRow ? { w: ownMain, h: ownCross } : { w: ownCross, h: ownMain };
    return this.size;
  }
}
```

`packages/layout/src/index.ts` (append):
```ts
export { FlexNode } from './flex';
export type { FlexNodeProps, FlexDirection, Justify, Align } from './flex';
```

- [ ] **Step 4: Run test + typecheck**

Run: `pnpm vitest run packages/layout/test/flex.test.ts`
Expected: PASS (8 tests).

Run: `pnpm typecheck`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(layout): FlexNode (row/column, gap, flex-grow, justify, align)"
```

---

## Task 5: StackNode (absolute positioning)

**Files:**
- Create: `packages/layout/src/stack.ts`
- Modify: `packages/layout/src/index.ts`
- Test: `packages/layout/test/stack.test.ts`

- [ ] **Step 1: Write the failing test**

`packages/layout/test/stack.test.ts`:
```ts
import { test, expect } from 'vitest';
import { StackNode, BoxNode } from '../src/index';
import { fakeMeasure } from './fake-measure';

const ctx = fakeMeasure();

test('StackNode positions children by their left/top', () => {
  const a = new BoxNode({ width: 10, height: 10 });
  a.left = 5;
  a.top = 8;
  const b = new BoxNode({ width: 10, height: 10 });
  // no left/top -> defaults to 0,0
  const stack = new StackNode({ children: [a, b] });
  stack.layout({ minW: 0, maxW: 100, minH: 0, maxH: 100 }, ctx);
  expect(a.offsetX).toBe(5);
  expect(a.offsetY).toBe(8);
  expect(b.offsetX).toBe(0);
  expect(b.offsetY).toBe(0);
});

test('StackNode fills bounded constraints', () => {
  const stack = new StackNode({ children: [] });
  const size = stack.layout({ minW: 0, maxW: 100, minH: 0, maxH: 50 }, ctx);
  expect(size).toEqual({ w: 100, h: 50 });
});

test('StackNode sizes to the child bounding box when unbounded', () => {
  const a = new BoxNode({ width: 10, height: 10 });
  a.left = 5;
  a.top = 8;
  const stack = new StackNode({ children: [a] });
  const size = stack.layout({ minW: 0, maxW: Infinity, minH: 0, maxH: Infinity }, ctx);
  expect(size).toEqual({ w: 15, h: 18 }); // left+w, top+h
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run packages/layout/test/stack.test.ts`
Expected: FAIL — `StackNode` not exported.

- [ ] **Step 3: Implement stack.ts and export it**

`packages/layout/src/stack.ts`:
```ts
import { LayoutNode } from './node';
import { type Constraints, type Size, type LayoutContext } from './types';

export interface StackNodeProps {
  children?: LayoutNode[];
}

export class StackNode extends LayoutNode {
  constructor(props: StackNodeProps = {}) {
    super();
    this.children = props.children ?? [];
  }

  layout(c: Constraints, ctx: LayoutContext): Size {
    let maxRight = 0;
    let maxBottom = 0;
    for (const ch of this.children) {
      const s = ch.layout({ minW: 0, maxW: c.maxW, minH: 0, maxH: c.maxH }, ctx);
      const l = ch.left ?? 0;
      const t = ch.top ?? 0;
      ch.offsetX = l;
      ch.offsetY = t;
      maxRight = Math.max(maxRight, l + s.w);
      maxBottom = Math.max(maxBottom, t + s.h);
    }
    const w = isFinite(c.maxW) ? c.maxW : maxRight;
    const h = isFinite(c.maxH) ? c.maxH : maxBottom;
    this.size = { w: Math.max(w, c.minW), h: Math.max(h, c.minH) };
    return this.size;
  }
}
```

`packages/layout/src/index.ts` (append):
```ts
export { StackNode } from './stack';
export type { StackNodeProps } from './stack';
```

- [ ] **Step 4: Run test + typecheck**

Run: `pnpm vitest run packages/layout/test/stack.test.ts`
Expected: PASS (3 tests).

Run: `pnpm typecheck`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(layout): StackNode (absolute positioning via left/top)"
```

---

## Task 6: Nested integration test, README, full-workspace green

**Files:**
- Create: `packages/layout/README.md`
- Test: `packages/layout/test/box.test.ts` (append a nested integration test)

- [ ] **Step 1: Add a nested integration test**

Create `packages/layout/test/integration.test.ts`. NOTE: a `FlexNode` FILLS its bounded
main axis (Flutter `mainAxisSize.max` default), so a Row inside a padded Box does NOT
shrink-wrap its width — it expands to the available width. The test documents this:
```ts
import { test, expect } from 'vitest';
import { BoxNode, FlexNode, TextNode } from '../src/index';
import { fakeMeasure } from './fake-measure';

const ctx = fakeMeasure();

test('nested tree: Box(padding) > Row(gap) > two fixed boxes', () => {
  const a = new BoxNode({ width: 10, height: 20 });
  const b = new BoxNode({ width: 30, height: 40 });
  const row = new FlexNode({ direction: 'row', gap: 5, children: [a, b] });
  const outer = new BoxNode({ padding: 8, child: row });

  const size = outer.layout({ minW: 0, maxW: 500, minH: 0, maxH: 500 }, ctx);

  expect(row.size.w).toBe(484); // fills 500 - 16 padding
  expect(row.size.h).toBe(40); // cross wraps tallest child
  expect(size).toEqual({ w: 500, h: 40 + 16 });
  expect(row.offsetX).toBe(8);
  expect(row.offsetY).toBe(8);
  expect(a.offsetX).toBe(0);
  expect(b.offsetX).toBe(15); // 10 + gap 5
});

test('nested tree: Column of Text rows wraps to content height', () => {
  const t1 = new TextNode({ text: 'hello', style: { font: '10px sans-serif' } });
  const t2 = new TextNode({ text: 'world!', style: { font: '10px sans-serif' } });
  const col = new FlexNode({ direction: 'column', gap: 4, children: [t1, t2] });
  const size = col.layout({ minW: 0, maxW: 200, minH: 0, maxH: Infinity }, ctx);
  expect(size.h).toBe(24); // 10 + 4 + 10 (unbounded main wraps content)
  expect(t2.offsetY).toBe(14);
});
```

- [ ] **Step 2: Run the full layout suite**

Run: `pnpm vitest run packages/layout`
Expected: PASS (node 5 + text 4 + box 6 + flex 8 + stack 3 = 26).

- [ ] **Step 3: Write the README**

`packages/layout/README.md`:
```markdown
# @cairn/layout

DOM-free layout engine for Cairn, using the Flutter model: **constraints down, size up**.

## Nodes

- `BoxNode` — single child + padding and fixed/min/max sizing.
- `FlexNode` — `row`/`column` with `gap`, per-child `flex` (grow), `justify` (main axis),
  and `align` (cross axis, incl. `stretch`).
- `TextNode` — single-line text; measures via the injected `LayoutContext`.
- `StackNode` — absolute positioning via each child's `left`/`top`.

## Protocol

Every node implements `layout(constraints, ctx): Size`. The parent passes `Constraints`
down; the node returns its `Size` up and sets each child's relative `offsetX`/`offsetY`.
Text measurement is injected via `LayoutContext.measureText`, so the engine has no DOM or
renderer dependency.

## Example

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

- [ ] **Step 4: Run the full workspace suite + typecheck**

Run: `pnpm vitest run`
Expected: PASS — all packages green (reactivity + host + platform-web + layout).

Run: `pnpm typecheck`
Expected: no errors across all four packages.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "test(layout): nested integration test; README; finalize @cairn/layout"
```

---

## Self-Review Notes (for the implementer)

- **Spec coverage:** Constraints/Size/LayoutContext + LayoutNode base -> Task 1. TextNode (measured, single-line, font-size height) -> Task 2. BoxNode (padding + sizing, deflate child) -> Task 3. FlexNode (row/column, gap, flex-grow two-phase, justify, align incl. stretch) -> Task 4. StackNode (absolute via left/top, bounded-fill vs bbox) -> Task 5. Nested integration + README -> Task 6. Relative offsets set by parents throughout; parent-data `flex`/`left`/`top` on the child.
- **Deferred (per spec):** margin, flex-shrink, wrap, multi-line text, reactive binding/paint/hit-test — not in this plan.
- **Type consistency:** `layout(c: Constraints, ctx: LayoutContext): Size` is identical across every node. `resolveAxis(cMin, cMax, exact?, min?, max?)` and `clamp(value, min, max)` match in box.ts and tests. `LayoutContext.measureText(text, style)` matches the fake in `fake-measure.ts`. Node fields (`size`, `offsetX`, `offsetY`, `flex`, `left`, `top`, `children`) are consistent everywhere.
- **Determinism:** all tests use `fakeMeasure()` (`width = text.length * fontSize * 0.6`), so coordinate assertions are exact.
