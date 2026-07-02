# Cairn Phase 10a — Layout & Style Foundations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete the layout engine — sized flex containers, Box child alignment, flex-grow, `Stack` positioning, and borders — removing the counter/todo workarounds and unblocking 10b widgets.

**Architecture:** Mostly exposes existing engine power (`StackNode`, `LayoutNode.flex/left/top`, `strokeRoundRect` all exist) plus two small layout additions (FlexNode size, BoxNode child alignment). Style gains `alignX`/`alignY`/`border`; a `LayoutChildProps` mixin carries `flex`/`left`/`top`.

**Tech Stack:** TypeScript strict, pnpm, Vitest. `resolveStyle` already merges any non-state `BaseStyle` key, so new style fields flow through with no resolver change.

**Spec:** `docs/superpowers/specs/2026-07-02-cairn-layout-foundations-design.md`

---

## Task 1: Layout — `FlexNode` width/height

**Files:** `packages/layout/src/flex.ts`; test `packages/layout/test/flex-size.test.ts`.

- [ ] **Step 1: Failing test** — `packages/layout/test/flex-size.test.ts`:

```ts
import { test, expect } from 'vitest';
import { FlexNode, BoxNode } from '../src/index';
import type { LayoutContext } from '../src/index';

const ctx: LayoutContext = { measureText: (t) => ({ width: t.length * 7 }) };

test('explicit width/height override the computed size', () => {
  const col = new FlexNode({ direction: 'column', width: 120, height: 90, children: [new BoxNode({ width: 20, height: 20 })] });
  col.layout({ minW: 0, maxW: 500, minH: 0, maxH: 500 }, ctx);
  expect(col.size).toEqual({ w: 120, h: 90 });
});

test('explicit height overrides even mainAxisSize:min', () => {
  const col = new FlexNode({ direction: 'column', mainAxisSize: 'min', height: 200, children: [new BoxNode({ width: 20, height: 20 })] });
  col.layout({ minW: 0, maxW: 500, minH: 0, maxH: 500 }, ctx);
  expect(col.size.h).toBe(200);
});
```

- [ ] **Step 2: Verify FAIL** — `pnpm vitest run packages/layout/test/flex-size.test.ts`.

- [ ] **Step 3: Implement** — in `packages/layout/src/flex.ts`:

Add to `FlexNodeProps` (after `mainAxisSize?`): `width?: number;` and `height?: number;`.
Add class fields: `width?: number;` `height?: number;` and constructor init:
```ts
    this.width = props.width;
    this.height = props.height;
```

**Flex free-space fix:** so flex children split the explicit size (not the constraint `maxW`), add — right BEFORE the "Phase 2: flex children" loop:
```ts
    const explicitMain = isRow ? this.width : this.height;
```
and change the `free` line (currently `const free = Math.max(0, (isFinite(mainMax) ? mainMax : usedMain) - usedMain);`) to:
```ts
    const availMain = explicitMain != null ? explicitMain : isFinite(mainMax) ? mainMax : usedMain;
    const free = Math.max(0, availMain - usedMain);
```

Replace the `ownMain` computation (the `const minMain = ...; const ownMain = ...` block from Phase 9) with (reusing the `explicitMain` defined above):
```ts
    const minMain = isRow ? c.minW : c.minH;
    const ownMain =
      explicitMain != null
        ? clamp(explicitMain, minMain, isFinite(mainMax) ? mainMax : explicitMain)
        : this.mainAxisSize === 'min'
          ? clamp(contentMain, minMain, isFinite(mainMax) ? mainMax : contentMain)
          : isFinite(mainMax)
            ? mainMax
            : contentMain;
```
Replace the `ownCross` computation with (preserving the existing stretch/clamp behavior as the fallback):
```ts
    const explicitCross = isRow ? this.height : this.width;
    const minCross = isRow ? c.minH : c.minW;
    const ownCross =
      explicitCross != null
        ? clamp(explicitCross, minCross, crossMax)
        : this.align === 'stretch' && isFinite(crossMax)
          ? crossMax
          : clamp(maxCross, minCross, crossMax);
```
(If the existing `ownCross` uses `isRow ? c.minH : c.minW` inline, `minCross` replaces it — keep semantics identical.)

- [ ] **Step 4: Verify green** — `pnpm vitest run packages/layout/test/flex-size.test.ts` (2 PASS); `pnpm vitest run packages/layout` (existing pass, incl. flex-main-axis-size); `pnpm typecheck`.

- [ ] **Step 5: Commit**
```bash
git add packages/layout/src/flex.ts packages/layout/test/flex-size.test.ts
git commit -m "feat(layout): FlexNode explicit width/height (override computed size)"
```

---

## Task 2: Layout — `BoxNode` child alignment

**Files:** `packages/layout/src/box.ts`; test `packages/layout/test/box-align.test.ts`.

- [ ] **Step 1: Failing test** — `packages/layout/test/box-align.test.ts`:

```ts
import { test, expect } from 'vitest';
import { BoxNode } from '../src/index';
import type { LayoutContext } from '../src/index';

const ctx: LayoutContext = { measureText: (t) => ({ width: t.length * 7 }) };

test('center alignment offsets the child within a larger box', () => {
  const box = new BoxNode({ width: 100, height: 60, alignX: 'center', alignY: 'center', child: new BoxNode({ width: 20, height: 20 }) });
  box.layout({ minW: 0, maxW: 200, minH: 0, maxH: 200 }, ctx);
  const child = box.children[0];
  expect(child.offsetX).toBe(40); // (100-20)/2
  expect(child.offsetY).toBe(20); // (60-20)/2
});

test('end alignment pushes the child to the far edge', () => {
  const box = new BoxNode({ width: 100, height: 60, alignX: 'end', alignY: 'end', child: new BoxNode({ width: 20, height: 20 }) });
  box.layout({ minW: 0, maxW: 200, minH: 0, maxH: 200 }, ctx);
  const child = box.children[0];
  expect(child.offsetX).toBe(80);
  expect(child.offsetY).toBe(40);
});

test('default start alignment keeps the child at padding origin', () => {
  const box = new BoxNode({ width: 100, height: 60, padding: 8, child: new BoxNode({ width: 20, height: 20 }) });
  box.layout({ minW: 0, maxW: 200, minH: 0, maxH: 200 }, ctx);
  expect(box.children[0].offsetX).toBe(8);
  expect(box.children[0].offsetY).toBe(8);
});
```

- [ ] **Step 2: Verify FAIL** — `pnpm vitest run packages/layout/test/box-align.test.ts`.

- [ ] **Step 3: Implement** — in `packages/layout/src/box.ts`:

Add to `BoxNodeProps` (after `child?`): `alignX?: 'start' | 'center' | 'end';` and `alignY?: 'start' | 'center' | 'end';`.
Add class fields + constructor init:
```ts
  alignX: 'start' | 'center' | 'end';
  alignY: 'start' | 'center' | 'end';
```
```ts
    this.alignX = props.alignX ?? 'start';
    this.alignY = props.alignY ?? 'start';
```
In `layout()`, inside the `if (child)` block, AFTER `w`/`h` are computed (replacing the `child.offsetX = p.left; child.offsetY = p.top;` lines which currently precede the w/h clamp — move alignment to the end so it uses the final box size):

Change the child block so offsets are set after `w`/`h`:
```ts
    if (child) {
      const childMaxW = Math.max(0, selfMaxW - p.left - p.right);
      const childMaxH = Math.max(0, selfMaxH - p.top - p.bottom);
      const cs = child.layout({ minW: 0, maxW: childMaxW, minH: 0, maxH: childMaxH }, ctx);
      w = clamp(cs.w + p.left + p.right, selfMinW, selfMaxW);
      h = clamp(cs.h + p.top + p.bottom, selfMinH, selfMaxH);
      const extraX = Math.max(0, w - p.left - p.right - cs.w);
      const extraY = Math.max(0, h - p.top - p.bottom - cs.h);
      child.offsetX = p.left + (this.alignX === 'center' ? extraX / 2 : this.alignX === 'end' ? extraX : 0);
      child.offsetY = p.top + (this.alignY === 'center' ? extraY / 2 : this.alignY === 'end' ? extraY : 0);
    } else {
      w = selfMinW;
      h = selfMinH;
    }
```

- [ ] **Step 4: Verify green** — `pnpm vitest run packages/layout/test/box-align.test.ts` (3 PASS); `pnpm vitest run packages/layout` (existing box tests still pass); `pnpm typecheck`.

- [ ] **Step 5: Commit**
```bash
git add packages/layout/src/box.ts packages/layout/test/box-align.test.ts
git commit -m "feat(layout): BoxNode child alignment (alignX/alignY)"
```

---

## Task 3: Style — `alignX`/`alignY`/`border` on `BaseStyle`

**Files:** `packages/style/src/style.ts`; test `packages/style/test/base-style-fields.test.ts`.

- [ ] **Step 1: Failing test** — `packages/style/test/base-style-fields.test.ts`:

```ts
import { test, expect } from 'vitest';
import { resolveStyle, type Style } from '../src/index';

test('alignX/alignY/border pass through resolveStyle and cascade', () => {
  const base: Style = { alignX: 'center', border: { width: 1, color: '#000' } };
  const override: Style = { alignY: 'end', border: { width: 2, color: '#fff' } };
  const r = resolveStyle([base, override]);
  expect(r.alignX).toBe('center');
  expect(r.alignY).toBe('end');
  expect(r.border).toEqual({ width: 2, color: '#fff' }); // later wins
});

test('border can be set in a state variant', () => {
  const r = resolveStyle({ border: { width: 1, color: '#000' }, hover: { border: { width: 2, color: '#f00' } } }, ['hover']);
  expect(r.border).toEqual({ width: 2, color: '#f00' });
});
```

- [ ] **Step 2: Verify FAIL** — `pnpm vitest run packages/style/test/base-style-fields.test.ts` (type errors: fields not on BaseStyle).

- [ ] **Step 3: Implement** — in `packages/style/src/style.ts`, add to `BaseStyle` (after `borderRadius?`):

```ts
  border?: { width: number; color: string };
  alignX?: 'start' | 'center' | 'end';
  alignY?: 'start' | 'center' | 'end';
```

(No resolver change: `mergeBase` copies every non-state key, so these flow through and cascade automatically.)

- [ ] **Step 4: Verify green** — `pnpm vitest run packages/style/test/base-style-fields.test.ts` (2 PASS); `pnpm vitest run packages/style`; `pnpm typecheck`.

- [ ] **Step 5: Commit**
```bash
git add packages/style/src/style.ts packages/style/test/base-style-fields.test.ts
git commit -m "feat(style): BaseStyle border + alignX/alignY"
```

---

## Task 4: Primitives — `LayoutChildProps` (flex/left/top)

**Files:** create `packages/primitives/src/layout-child.ts`; modify `packages/primitives/src/{box,text,flex}.ts`, `packages/primitives/src/index.ts`; test `packages/primitives/test/layout-child.test.ts`.

- [ ] **Step 1: Failing test** — `packages/primitives/test/layout-child.test.ts`:

```ts
import { test, expect } from 'vitest';
import { createRoot } from '@cairn/reactivity';
import { setFrameRequester } from '@cairn/runtime';
import { Box, Row } from '../src/index';

test('flex/left/top props set the instance layout parent-data', () => {
  setFrameRequester(() => {});
  const dispose = createRoot((d) => {
    const b = Box({ flex: 2, left: 10, top: 20 });
    expect(b.layout.flex).toBe(2);
    expect(b.layout.left).toBe(10);
    expect(b.layout.top).toBe(20);
    const r = Row({});
    expect(r.layout.flex).toBe(0); // default untouched
    return d;
  });
  dispose();
  setFrameRequester(null);
});
```

- [ ] **Step 2: Verify FAIL** — `pnpm vitest run packages/primitives/test/layout-child.test.ts`.

- [ ] **Step 3: Create the mixin** — `packages/primitives/src/layout-child.ts`:

```ts
import { type Instance } from '@cairn/runtime';

// Parent-data props: meaningful inside a Flex (flex) or Stack (left/top) parent.
export interface LayoutChildProps {
  flex?: number;
  left?: number;
  top?: number;
}

export function applyLayoutChildProps(inst: Instance, props: LayoutChildProps): void {
  if (props.flex !== undefined) inst.layout.flex = props.flex;
  if (props.left !== undefined) inst.layout.left = props.left;
  if (props.top !== undefined) inst.layout.top = props.top;
}
```

- [ ] **Step 4: Wire into Box/Text/Flex** — each: extend props with `LayoutChildProps`, assign the returned object to a `const instance`, call `applyLayoutChildProps(instance, props)` before returning.

`box.ts`: `export interface BoxProps extends EventProps, LayoutChildProps { ... }`; import `{ applyLayoutChildProps, type LayoutChildProps }`; change `return { ... }` to:
```ts
  const instance: Instance = {
    layout,
    children: child ? [child] : [],
    handlers,
    focusable: props.focusable,
    paintSelf(r: Renderer) { /* unchanged */ },
  };
  applyLayoutChildProps(instance, props);
  return instance;
```

`text.ts`: `export interface TextProps extends EventProps, LayoutChildProps { ... }`; same pattern — assign the returned instance to a const, `applyLayoutChildProps(instance, props)`, return it.

`flex.ts`: `export interface FlexProps extends EventProps, LayoutChildProps { ... }`; in `flex(...)`, assign the returned object to `const instance`, `applyLayoutChildProps(instance, props)`, return it.

- [ ] **Step 5: Export** — in `packages/primitives/src/index.ts`:
```ts
export { applyLayoutChildProps } from './layout-child';
export type { LayoutChildProps } from './layout-child';
```

- [ ] **Step 6: Verify green** — `pnpm vitest run packages/primitives/test/layout-child.test.ts` (1 PASS); `pnpm vitest run packages/primitives`; `pnpm typecheck`.

- [ ] **Step 7: Commit**
```bash
git add packages/primitives/src/layout-child.ts packages/primitives/src/box.ts packages/primitives/src/text.ts packages/primitives/src/flex.ts packages/primitives/src/index.ts packages/primitives/test/layout-child.test.ts
git commit -m "feat(primitives): LayoutChildProps (flex/left/top) on Box/Text/Flex"
```

---

## Task 5: Primitives — Box alignX/alignY + border

**Files:** `packages/primitives/src/box.ts`; test `packages/primitives/test/box-align-border.test.ts`.

- [ ] **Step 1: Failing test** — `packages/primitives/test/box-align-border.test.ts`:

```ts
import { test, expect } from 'vitest';
import { createRoot } from '@cairn/reactivity';
import { setFrameRequester } from '@cairn/runtime';
import { BoxNode } from '@cairn/layout';
import { Box } from '../src/index';
import { createFakeRenderer, fakeCtx, LOOSE } from './fake';

test('Box forwards alignX/alignY to the BoxNode', () => {
  setFrameRequester(() => {});
  const dispose = createRoot((d) => {
    const b = Box({ style: { width: 100, height: 50, alignX: 'center', alignY: 'end' } });
    expect((b.layout as BoxNode).alignX).toBe('center');
    expect((b.layout as BoxNode).alignY).toBe('end');
    return d;
  });
  dispose();
  setFrameRequester(null);
});

test('Box paints a border stroke when style.border is set', () => {
  setFrameRequester(() => {});
  let b!: ReturnType<typeof Box>;
  const dispose = createRoot((d) => {
    b = Box({ style: { width: 40, height: 30, borderRadius: 8, border: { width: 2, color: '#f00' } } });
    return d;
  });
  b.layout.layout(LOOSE, fakeCtx);
  const r = createFakeRenderer();
  b.paintSelf(r);
  const stroke = r.calls.find((c) => c[0] === 'strokeRoundRect');
  expect(stroke).toBeTruthy();
  expect((stroke![3] as { color: string; width: number })).toEqual({ color: '#f00', width: 2 });
  dispose();
  setFrameRequester(null);
});
```

- [ ] **Step 2: Verify FAIL** — `pnpm vitest run packages/primitives/test/box-align-border.test.ts`.

- [ ] **Step 3: Implement** — in `packages/primitives/src/box.ts`:

In the `bind(resolved, (s) => { ... })`, add after the padding line:
```ts
    layout.alignX = s.alignX ?? 'start';
    layout.alignY = s.alignY ?? 'start';
```
Replace `paintSelf` with:
```ts
    paintSelf(r: Renderer) {
      const s = current;
      const w = layout.size.w;
      const h = layout.size.h;
      if (s.backgroundColor) {
        r.fillRoundRect({ x: 0, y: 0, width: w, height: h }, s.borderRadius ?? 0, { color: s.backgroundColor });
      }
      if (s.border) {
        const bw = s.border.width;
        r.strokeRoundRect(
          { x: bw / 2, y: bw / 2, width: Math.max(0, w - bw), height: Math.max(0, h - bw) },
          Math.max(0, (s.borderRadius ?? 0) - bw / 2),
          { color: s.border.color, width: bw },
        );
      }
    },
```

- [ ] **Step 4: Verify green** — `pnpm vitest run packages/primitives/test/box-align-border.test.ts` (2 PASS); `pnpm vitest run packages/primitives`; `pnpm typecheck`.

- [ ] **Step 5: Commit**
```bash
git add packages/primitives/src/box.ts packages/primitives/test/box-align-border.test.ts
git commit -m "feat(primitives): Box child alignment + border painting"
```

---

## Task 6: Primitives — Flex width/height from style

**Files:** `packages/primitives/src/flex.ts`; test `packages/primitives/test/flex-size.test.ts`.

- [ ] **Step 1: Failing test** — `packages/primitives/test/flex-size.test.ts`:

```ts
import { test, expect } from 'vitest';
import { createRoot } from '@cairn/reactivity';
import { setFrameRequester } from '@cairn/runtime';
import { Box, Row, Column } from '../src/index';
import { fakeCtx } from './fake';

test('Column sizes from style width/height', () => {
  setFrameRequester(() => {});
  const dispose = createRoot((d) => {
    const col = Column({ style: { width: 300, height: 200 } });
    col.layout.layout({ minW: 0, maxW: 1000, minH: 0, maxH: 1000 }, fakeCtx);
    expect(col.layout.size).toEqual({ w: 300, h: 200 });
    return d;
  });
  dispose();
  setFrameRequester(null);
});

test('flex children split the main axis in a sized Row', () => {
  setFrameRequester(() => {});
  const dispose = createRoot((d) => {
    const a = Box({ flex: 1, style: { height: 10 } });
    const b = Box({ flex: 1, style: { height: 10 } });
    const row = Row({ style: { width: 300 }, children: [a, b] });
    row.layout.layout({ minW: 0, maxW: 1000, minH: 0, maxH: 1000 }, fakeCtx);
    expect(a.layout.size.w).toBe(150);
    expect(b.layout.size.w).toBe(150);
    return d;
  });
  dispose();
  setFrameRequester(null);
});
```

- [ ] **Step 2: Verify FAIL** — `pnpm vitest run packages/primitives/test/flex-size.test.ts`.

- [ ] **Step 3: Implement** — in `packages/primitives/src/flex.ts`, inside `bind(resolved, (s) => { ... })`, add:
```ts
    layout.width = s.width;
    layout.height = s.height;
```

- [ ] **Step 4: Verify green** — `pnpm vitest run packages/primitives/test/flex-size.test.ts` (2 PASS); `pnpm vitest run packages/primitives`; `pnpm typecheck`.

- [ ] **Step 5: Commit**
```bash
git add packages/primitives/src/flex.ts packages/primitives/test/flex-size.test.ts
git commit -m "feat(primitives): Row/Column size from style width/height"
```

---

## Task 7: Primitives — `Stack`

**Files:** create `packages/primitives/src/stack.ts`; modify `packages/primitives/src/index.ts`; test `packages/primitives/test/stack.test.ts`.

- [ ] **Step 1: Failing test** — `packages/primitives/test/stack.test.ts`:

```ts
import { test, expect } from 'vitest';
import { createRoot } from '@cairn/reactivity';
import { setFrameRequester } from '@cairn/runtime';
import { StackNode } from '@cairn/layout';
import { Box, Stack } from '../src/index';
import { fakeCtx } from './fake';

test('Stack positions children by their left/top', () => {
  setFrameRequester(() => {});
  const dispose = createRoot((d) => {
    const a = Box({ left: 10, top: 20, style: { width: 30, height: 30 } });
    const b = Box({ left: 50, top: 5, style: { width: 30, height: 30 } });
    const stack = Stack({ children: [a, b] });
    expect(stack.layout).toBeInstanceOf(StackNode);
    stack.layout.layout({ minW: 0, maxW: 200, minH: 0, maxH: 200 }, fakeCtx);
    expect(a.layout.offsetX).toBe(10);
    expect(a.layout.offsetY).toBe(20);
    expect(b.layout.offsetX).toBe(50);
    expect(b.layout.offsetY).toBe(5);
    return d;
  });
  dispose();
  setFrameRequester(null);
});
```

- [ ] **Step 2: Verify FAIL** — `pnpm vitest run packages/primitives/test/stack.test.ts`.

- [ ] **Step 3: Implement** — `packages/primitives/src/stack.ts`:

```ts
import { StackNode } from '@cairn/layout';
import { type Instance } from '@cairn/runtime';
import { applyLayoutChildProps, type LayoutChildProps } from './layout-child';

export interface StackProps extends LayoutChildProps {
  children?: Instance | Instance[];
}

// A bare absolute-positioning container: children are placed at their left/top
// (set via LayoutChildProps). Wrap in a Box for a background/padding.
export function Stack(props: StackProps = {}): Instance {
  const children =
    props.children == null ? [] : Array.isArray(props.children) ? props.children : [props.children];
  const layout = new StackNode({ children: children.map((c) => c.layout) });
  const instance: Instance = { layout, children, paintSelf() {} };
  applyLayoutChildProps(instance, props);
  return instance;
}
```

- [ ] **Step 4: Export** — in `packages/primitives/src/index.ts`:
```ts
export { Stack } from './stack';
export type { StackProps } from './stack';
```

- [ ] **Step 5: Verify green** — `pnpm vitest run packages/primitives/test/stack.test.ts` (1 PASS); `pnpm vitest run packages/primitives`; `pnpm typecheck`.

- [ ] **Step 6: Commit**
```bash
git add packages/primitives/src/stack.ts packages/primitives/src/index.ts packages/primitives/test/stack.test.ts
git commit -m "feat(primitives): Stack (absolute positioning)"
```

---

## Task 8: Counter refactor + full green

**Files:** `examples/counter/main.tsx`. (No new unit tests; workspace stays green.)

- [ ] **Step 1: Refactor the `Button` helper** to use Box child-alignment (drop the `Column>Row` nesting) and support optional border + flex:

```tsx
function Button(props: {
  label: string;
  width?: number;
  height: number;
  flex?: number;
  bg: string;
  color: string;
  hoverBg?: string;
  border?: { width: number; color: string };
  font?: string;
  onClick: () => void;
}): Instance {
  return (
    <Box
      flex={props.flex}
      style={{
        width: props.width,
        height: props.height,
        backgroundColor: props.bg,
        borderRadius: 16,
        alignX: 'center',
        alignY: 'center',
        border: props.border,
        hover: props.hoverBg ? { backgroundColor: props.hoverBg } : {},
      }}
      onClick={props.onClick}
    >
      <Text style={{ font: props.font ?? '26px sans-serif', color: props.color }}>{props.label}</Text>
    </Box>
  ) as unknown as Instance;
}
```

- [ ] **Step 2: Use `flex` + `border`** in the counter's button row and reset. In `App`, size the button Row and let `+` grow:

The `−`/`+` row: give the Row an explicit width so flex distributes, and make `+` grow:
```tsx
          <Row style={{ gap: 12, width: 384 }}>
            <Button label="−" width={120} height={68} bg="#2a2a2c" color="#e5e7eb" hoverBg="#333336" border={{ width: 1, color: '#3a3a3e' }} onClick={() => setCount(Math.max(0, count() - step()))} />
            <Button label="+" flex={1} height={68} bg="#4577e6" color="#ffffff" hoverBg="#5482ea" onClick={() => setCount(count() + step())} />
          </Row>
```
Reset button keeps `width={384}` and gains a border:
```tsx
          <Button label="↻  Сбросить" width={384} height={56} bg="#161618" color="#d1d5db" hoverBg="#202023" border={{ width: 1, color: '#2a2a2e' }} font="16px sans-serif" onClick={() => setCount(0)} />
```
(Keep the rest of the file — card, number, subtitle, slider row — unchanged.)

- [ ] **Step 3: Full workspace green** — `pnpm vitest run` (all pass); `pnpm typecheck`.

- [ ] **Step 4: Commit**
```bash
git add examples/counter/main.tsx
git commit -m "example(counter): use Box alignX/alignY + flex-grow + borders (drop layout workarounds)"
```

---

## Exit Criteria

- Sized flex containers, Box child alignment, flex-grow, `Stack` positioning, and borders all work.
- `pnpm vitest run` + `pnpm typecheck` green across the workspace.
- Counter renders correctly with the `Column>Row` nesting and hardcoded `+` width removed (manual browser check).

## Out of Scope (→ 10b / later)

Widgets (Button/Slider/Checkbox/Switch/Image/Icon/Divider); `text-align` on Text; per-side borders / per-corner radius; grid; scroll.
