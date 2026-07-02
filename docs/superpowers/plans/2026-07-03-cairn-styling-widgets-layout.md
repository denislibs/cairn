# Cairn Styling, Widgets & Layout — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the "cheap-to-medium" styling/layout/widget capabilities from `docs/styling-and-capabilities.md` — style plumbing (shadows, gradients, per-corner/per-side borders, opacity, textAlign, lineHeight, min/max), full flex/positioning layout (margin, gaps, alignSelf, shrink/basis, wrap, right/bottom/inset, zIndex, aspectRatio), and the widget set (Image, Icon, Svg/Path, Button, Slider, Checkbox, Switch, Divider).

**Architecture:** The renderer already supports shadows/gradients/rounded-rects/paths/images. Group A adds two renderer ops (`setGlobalAlpha`, `setLineDash`), widens `BaseStyle`, and wires `Box`/`Text`/paint-walker. Group B extends `FlexNode`/`BoxNode`/`StackNode` with parent-data and distribution logic. Group C adds draw primitives to `@cairn/primitives` and composed widgets to a new `@cairn/widgets` package.

**Tech Stack:** TypeScript (DOM-free core), pnpm workspace, Vitest. Packages: reactivity, host, layout, runtime, primitives, style, events, platform-web, +new widgets.

**Conventions (read once):**
- Run all tests from repo root: `pnpm vitest run` (whole workspace) or `pnpm vitest run <path>` for one file.
- Typecheck: `pnpm typecheck`.
- Tests live next to source in `packages/<pkg>/test/` or `*.test.ts` — follow the pattern already present in that package (`ls packages/<pkg>` and mirror it).
- A **recording renderer** (a fake `Renderer` that pushes each call into an array) is the standard way to assert paint output. If one already exists in `packages/primitives` tests, reuse it; otherwise create `packages/primitives/test/recording-renderer.ts` in Task A4 and reuse it thereafter.
- Commit after every task with a Conventional-Commit message and the trailer:
  `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`

---

## Group A — Style plumbing

### Task A1: Renderer `setGlobalAlpha` + `setLineDash`

**Files:**
- Modify: `packages/host/src/renderer.ts` (add two methods to `Renderer`)
- Modify: `packages/platform-web/src/canvas2d-renderer.ts` (implement them)
- Test: `packages/platform-web/test/canvas2d-renderer.test.ts` (create if absent; mirror existing test style)

- [ ] **Step 1: Write failing tests**

Use a mock `CanvasRenderingContext2D`-like object (a plain object recording property sets and method calls) passed via a fake `CanvasSurface { context }`.

```ts
import { describe, it, expect } from 'vitest';
import { Canvas2DRenderer } from '../src/canvas2d-renderer';

function makeCtx() {
  const calls: any[] = [];
  const ctx: any = {
    setTransform() {}, save() {}, restore() {},
    globalAlpha: 1,
    setLineDash(seg: number[]) { calls.push(['setLineDash', seg]); },
  };
  return { ctx, calls };
}
function makeRenderer(ctx: any) {
  return new Canvas2DRenderer({ context: ctx } as any);
}

describe('Canvas2DRenderer alpha/dash', () => {
  it('setGlobalAlpha sets ctx.globalAlpha', () => {
    const { ctx } = makeCtx();
    makeRenderer(ctx).setGlobalAlpha(0.5);
    expect(ctx.globalAlpha).toBe(0.5);
  });
  it('setLineDash forwards segments', () => {
    const { ctx, calls } = makeCtx();
    makeRenderer(ctx).setLineDash([6, 4]);
    expect(calls).toContainEqual(['setLineDash', [6, 4]]);
  });
});
```

- [ ] **Step 2: Run to verify failure** — `pnpm vitest run packages/platform-web/test/canvas2d-renderer.test.ts` → FAIL (methods don't exist).

- [ ] **Step 3: Add to the `Renderer` interface** in `packages/host/src/renderer.ts`, right after `setShadow`:

```ts
  setShadow(shadow: Shadow | null): void;
  // Multiplies the alpha of subsequent drawing (1 = opaque). Saved/restored by save()/restore().
  setGlobalAlpha(alpha: number): void;
  // Dash pattern for subsequent strokes; [] = solid. Saved/restored by save()/restore().
  setLineDash(segments: number[]): void;
```

- [ ] **Step 4: Implement in `canvas2d-renderer.ts`**, after `setShadow`:

```ts
  setGlobalAlpha(alpha: number): void {
    this.ctx.globalAlpha = alpha;
  }
  setLineDash(segments: number[]): void {
    this.ctx.setLineDash(segments);
  }
```

- [ ] **Step 5: Run tests** — `pnpm vitest run packages/platform-web/test/canvas2d-renderer.test.ts` → PASS. Then `pnpm typecheck`.

- [ ] **Step 6: Commit** — `feat(host): setGlobalAlpha + setLineDash renderer ops`

---

### Task A2: Opacity in the paint walker

**Files:**
- Modify: `packages/runtime/src/instance.ts` (add `paintOpacity`, thread alpha through `paint`)
- Test: `packages/runtime/test/paint-opacity.test.ts` (create)

- [ ] **Step 1: Write failing test** — a recording renderer asserts nested opacity multiplies.

```ts
import { describe, it, expect } from 'vitest';
import { paint, type Instance } from '../src/instance';
import { BoxNode } from '@cairn/layout';

function rec() {
  const calls: any[] = [];
  const r: any = new Proxy({}, { get: (_t, k) => (...a: any[]) => calls.push([k, ...a]) });
  return { r, calls };
}
function node(opacity: number | undefined, children: Instance[] = []): Instance {
  const layout = new BoxNode({}); layout.size = { w: 10, h: 10 };
  return { layout, children, paintOpacity: opacity, paintSelf() {} };
}

describe('paint opacity', () => {
  it('nested opacity multiplies and is set via setGlobalAlpha', () => {
    const { r, calls } = rec();
    paint(node(0.5, [node(0.5)]), r);
    const alphas = calls.filter((c) => c[0] === 'setGlobalAlpha').map((c) => c[1]);
    expect(alphas).toEqual([0.5, 0.25]);
  });
  it('no setGlobalAlpha when opacity is undefined or 1', () => {
    const { r, calls } = rec();
    paint(node(undefined, [node(1)]), r);
    expect(calls.some((c) => c[0] === 'setGlobalAlpha')).toBe(false);
  });
});
```

- [ ] **Step 2: Run to verify failure** — FAIL (`paintOpacity` not on `Instance`, walker ignores it).

- [ ] **Step 3: Implement.** In `instance.ts` add `paintOpacity?: number;` to the `Instance` interface, and rewrite `paint` to thread an accumulated alpha:

```ts
export function paint(inst: Instance, r: Renderer, parentAlpha = 1): void {
  r.save();
  r.translate(inst.layout.offsetX, inst.layout.offsetY);
  const o = inst.paintOpacity;
  const alpha = o !== undefined && o < 1 ? parentAlpha * o : parentAlpha;
  if (alpha !== parentAlpha) r.setGlobalAlpha(alpha);
  inst.paintSelf(r);
  for (const child of inst.children) paint(child, r, alpha);
  r.restore();
}
```

- [ ] **Step 4: Run tests** → PASS. `pnpm typecheck` (Instance change may surface missing `paintOpacity` — it's optional, so fine).

- [ ] **Step 5: Commit** — `feat(runtime): per-subtree opacity in paint walker`

---

### Task A3: Widen `BaseStyle` with paint fields

**Files:**
- Modify: `packages/style/src/style.ts`
- Test: `packages/style/test/style-fields.test.ts` (create) — a compile-level test that constructs a `Style` using every new field and resolves it.

- [ ] **Step 1: Write failing test**

```ts
import { describe, it, expect } from 'vitest';
import { resolveStyle, type Style } from '../src';

it('BaseStyle accepts new paint fields', () => {
  const s: Style = {
    minWidth: 10, maxWidth: 100, minHeight: 5, maxHeight: 50,
    borderRadius: { tl: 4, tr: 4, br: 0, bl: 0 },
    border: { width: 1, color: '#000', style: 'dashed' },
    borderTop: { width: 2, color: '#f00' },
    backgroundGradient: { kind: 'linear', from: { x: 0, y: 0 }, to: { x: 1, y: 1 }, stops: [{ offset: 0, color: '#000' }] },
    boxShadow: { color: '#0008', blur: 8, offsetX: 0, offsetY: 2 },
    opacity: 0.5,
    textShadow: { color: '#000', blur: 1, offsetX: 0, offsetY: 1 },
    textAlign: 'center',
    lineHeight: 20,
    hover: { opacity: 1 },
  };
  const r = resolveStyle(s, ['hover']);
  expect(r.opacity).toBe(1);
  expect(r.textAlign).toBe('center');
});
```

- [ ] **Step 2: Run to verify failure** — FAIL (types don't accept the fields).

- [ ] **Step 3: Implement.** In `packages/style/src/style.ts` add the value types and extend `BaseStyle`:

```ts
export interface Shadow {
  color: string; blur: number; offsetX: number; offsetY: number;
}
export type CornerRadius = number | { tl: number; tr: number; br: number; bl: number };
export interface BorderSide { width: number; color: string; style?: 'solid' | 'dashed' | 'dotted' }
export interface LinearGradient { kind: 'linear'; from: { x: number; y: number }; to: { x: number; y: number }; stops: { offset: number; color: string }[] }
export interface RadialGradient { kind: 'radial'; center: { x: number; y: number }; radius: number; stops: { offset: number; color: string }[] }
export type StyleGradient = LinearGradient | RadialGradient;
```

Then in `BaseStyle` (widen `borderRadius`/`border`, add the rest):

```ts
  minWidth?: number; maxWidth?: number; minHeight?: number; maxHeight?: number;
  borderRadius?: CornerRadius;
  border?: BorderSide;
  borderTop?: BorderSide; borderRight?: BorderSide; borderBottom?: BorderSide; borderLeft?: BorderSide;
  backgroundGradient?: StyleGradient;
  boxShadow?: Shadow;
  opacity?: number;
  textShadow?: Shadow;
  textAlign?: 'left' | 'center' | 'right';
  lineHeight?: number;
```

Export the new types from `packages/style/src/index.ts`:
```ts
export type { StateName, BaseStyle, Style, Shadow, CornerRadius, BorderSide, LinearGradient, RadialGradient, StyleGradient } from './style';
```

- [ ] **Step 4: Run tests** → PASS. `pnpm typecheck`. (The `borderRadius` widening from `number` to `CornerRadius` — check `Box` still compiles; it passes `s.borderRadius ?? 0` into `fillRoundRect` whose `Radii` type is `number | {tl,tr,br,bl}`, which is compatible. `(s.borderRadius ?? 0) - bw/2` in the current border code will now break for the object form — that's fixed in A4.)

- [ ] **Step 5: Commit** — `feat(style): widen BaseStyle with shadow/gradient/per-corner+per-side border/opacity/text fields`

---

### Task A4: Box paint — gradient, boxShadow, per-corner radius, per-side/dashed borders, min/max, opacity

**Files:**
- Modify: `packages/primitives/src/box.ts`
- Create: `packages/primitives/test/recording-renderer.ts` (shared fake renderer)
- Test: `packages/primitives/test/box-paint.test.ts` (create)

- [ ] **Step 1: Create the recording renderer** `packages/primitives/test/recording-renderer.ts`:

```ts
import type { Renderer } from '@cairn/host';
export interface Call { name: string; args: any[]; }
export function recordingRenderer(): { r: Renderer; calls: Call[] } {
  const calls: Call[] = [];
  const names = [
    'resize','beginFrame','endFrame','clear','save','restore','translate','scale',
    'clipRect','setShadow','setGlobalAlpha','setLineDash','fillRect','strokeRect',
    'fillRoundRect','strokeRoundRect','fillPath','strokePath','drawText','drawImage',
  ];
  const r: any = {};
  for (const n of names) r[n] = (...args: any[]) => calls.push({ name: n, args });
  r.measureText = (t: string) => ({ width: t.length * 8 });
  return { r: r as Renderer, calls };
}
```

- [ ] **Step 2: Write failing tests** for Box paint:

```ts
import { describe, it, expect } from 'vitest';
import { createRoot } from '@cairn/reactivity';
import { Box } from '../src/box';
import { recordingRenderer } from './recording-renderer';

function paintBox(style: any) {
  return createRoot(() => {
    const inst = Box({ style });
    inst.layout.size = { w: 100, h: 40 };
    const { r, calls } = recordingRenderer();
    inst.paintSelf(r);
    return { inst, calls };
  });
}

describe('Box paint', () => {
  it('fills with backgroundGradient (precedence over color)', () => {
    const { calls } = paintBox({ backgroundColor: '#fff', backgroundGradient: { kind: 'linear', from: { x: 0, y: 0 }, to: { x: 0, y: 1 }, stops: [{ offset: 0, color: '#000' }] } });
    const fill = calls.find((c) => c.name === 'fillRoundRect');
    expect(fill!.args[2].gradient).toBeTruthy();
  });
  it('wraps fill in shadow save/restore for boxShadow', () => {
    const { calls } = paintBox({ backgroundColor: '#fff', boxShadow: { color: '#000', blur: 4, offsetX: 0, offsetY: 2 } });
    const shadowOn = calls.findIndex((c) => c.name === 'setShadow' && c.args[0]);
    const fill = calls.findIndex((c) => c.name === 'fillRoundRect');
    const shadowOff = calls.findIndex((c, i) => i > fill && c.name === 'setShadow' && !c.args[0]);
    expect(shadowOn).toBeGreaterThanOrEqual(0);
    expect(shadowOn).toBeLessThan(fill);
    expect(shadowOff).toBeGreaterThan(fill);
  });
  it('per-corner borderRadius passed through', () => {
    const { calls } = paintBox({ backgroundColor: '#fff', borderRadius: { tl: 8, tr: 8, br: 0, bl: 0 } });
    const fill = calls.find((c) => c.name === 'fillRoundRect');
    expect(fill!.args[1]).toEqual({ tl: 8, tr: 8, br: 0, bl: 0 });
  });
  it('dashed border sets line dash', () => {
    const { calls } = paintBox({ border: { width: 2, color: '#000', style: 'dashed' } });
    expect(calls.some((c) => c.name === 'setLineDash' && c.args[0].length > 0)).toBe(true);
  });
  it('per-side top border draws a stroked line', () => {
    const { calls } = paintBox({ borderTop: { width: 2, color: '#f00' } });
    expect(calls.some((c) => c.name === 'strokePath' || c.name === 'strokeRect')).toBe(true);
  });
  it('sets paintOpacity from style', () => {
    const { inst } = paintBox({ opacity: 0.3 });
    expect(inst.paintOpacity).toBe(0.3);
  });
  it('forwards min/max to the BoxNode', () => {
    createRoot(() => {
      const inst = Box({ style: { minWidth: 10, maxWidth: 90, minHeight: 5, maxHeight: 40 } });
      const n = inst.layout as any;
      expect([n.minWidth, n.maxWidth, n.minHeight, n.maxHeight]).toEqual([10, 90, 5, 40]);
    });
  });
});
```

- [ ] **Step 3: Run to verify failure** — FAIL.

- [ ] **Step 4: Implement** `box.ts`. In the `bind(resolved, ...)` add min/max + opacity; rewrite `paintSelf`. Full new file body for the reactive bind and paint:

```ts
  bind(resolved, (s) => {
    current = s;
    layout.width = s.width;
    layout.height = s.height;
    layout.minWidth = s.minWidth;
    layout.maxWidth = s.maxWidth;
    layout.minHeight = s.minHeight;
    layout.maxHeight = s.maxHeight;
    layout.padding = toEdgeInsets(s.padding);
    layout.alignX = s.alignX ?? 'start';
    layout.alignY = s.alignY ?? 'start';
    instance.paintOpacity = s.opacity;
  });
```

(Note: `instance` is referenced inside `bind` — declare `instance` with `let` before `bind`, or set `paintOpacity` after creating `instance`. Simplest: keep a `let paintOpacity` mirror and assign `instance.paintOpacity = current.opacity` at the top of `paintSelf` is wrong because opacity must be read by the walker before paintSelf. Instead: declare the instance first, then call `bind` after. Restructure so `bind` runs after `const instance = {...}`.)

Restructured `Box`:

```ts
export function Box(props: BoxProps = {}): Instance {
  const child = props.children;
  const { resolved, handlers } = createInteractive(props);
  const layout = new BoxNode({ child: child?.layout });
  let current: BaseStyle = {};

  const instance: Instance = {
    layout,
    children: child ? [child] : [],
    handlers,
    focusable: props.focusable,
    paintSelf(r: Renderer) {
      paintBox(r, current, layout.size.w, layout.size.h);
    },
  };

  bind(resolved, (s) => {
    current = s;
    layout.width = s.width; layout.height = s.height;
    layout.minWidth = s.minWidth; layout.maxWidth = s.maxWidth;
    layout.minHeight = s.minHeight; layout.maxHeight = s.maxHeight;
    layout.padding = toEdgeInsets(s.padding);
    layout.alignX = s.alignX ?? 'start';
    layout.alignY = s.alignY ?? 'start';
    instance.paintOpacity = s.opacity;
  });

  applyLayoutChildProps(instance, props);
  return instance;
}
```

Add a `paintBox` helper in the same file:

```ts
function radiusToRadii(r: CornerRadius | undefined): Radii {
  return r ?? 0;
}
function dashFor(style: BorderSide['style'], width: number): number[] {
  if (style === 'dashed') return [width * 3, width * 2];
  if (style === 'dotted') return [width, width * 2];
  return [];
}
function paintBox(r: Renderer, s: BaseStyle, w: number, h: number): void {
  // fill (gradient wins over color) — wrapped in shadow if boxShadow set
  if (s.backgroundColor || s.backgroundGradient) {
    const fill: FillStyle = s.backgroundGradient
      ? { gradient: toHostGradient(s.backgroundGradient) }
      : { color: s.backgroundColor };
    if (s.boxShadow) { r.save(); r.setShadow(s.boxShadow); }
    r.fillRoundRect({ x: 0, y: 0, width: w, height: h }, radiusToRadii(s.borderRadius), fill);
    if (s.boxShadow) { r.setShadow(null); r.restore(); }
  }
  // uniform border (all four sides) if `border` set and no per-side override wins
  if (s.border) {
    const bw = s.border.width;
    r.save();
    r.setLineDash(dashFor(s.border.style, bw));
    r.strokeRoundRect(
      { x: bw / 2, y: bw / 2, width: Math.max(0, w - bw), height: Math.max(0, h - bw) },
      shrinkRadii(s.borderRadius, bw / 2),
      { color: s.border.color, width: bw },
    );
    r.setLineDash([]);
    r.restore();
  }
  // per-side borders (drawn as straight stroked segments; override same side of uniform)
  paintSide(r, s.borderTop, [0, 0], [w, 0]);
  paintSide(r, s.borderRight, [w, 0], [w, h]);
  paintSide(r, s.borderBottom, [0, h], [w, h]);
  paintSide(r, s.borderLeft, [0, 0], [0, h]);
}
function paintSide(r: Renderer, side: BorderSide | undefined, from: [number, number], to: [number, number]): void {
  if (!side) return;
  r.save();
  r.setLineDash(dashFor(side.style, side.width));
  const p = createPath().moveTo(from[0], from[1]).lineTo(to[0], to[1]).build();
  r.strokePath(p, { color: side.color, width: side.width });
  r.setLineDash([]);
  r.restore();
}
function shrinkRadii(r: CornerRadius | undefined, by: number): Radii {
  if (r == null) return 0;
  if (typeof r === 'number') return Math.max(0, r - by);
  return { tl: Math.max(0, r.tl - by), tr: Math.max(0, r.tr - by), br: Math.max(0, r.br - by), bl: Math.max(0, r.bl - by) };
}
function toHostGradient(g: StyleGradient): Gradient {
  return g as unknown as Gradient; // structurally identical shapes
}
```

Add imports at the top of `box.ts`:
```ts
import { type Renderer, type Radii, type FillStyle, type Gradient, createPath } from '@cairn/host';
import { type BaseStyle, type CornerRadius, type BorderSide, type StyleGradient } from '@cairn/style';
```

- [ ] **Step 5: Run tests** — `pnpm vitest run packages/primitives/test/box-paint.test.ts` → PASS. `pnpm typecheck`. Run full primitives tests to ensure no regression: `pnpm vitest run packages/primitives`.

- [ ] **Step 6: Commit** — `feat(primitives): Box paints gradient/shadow/per-corner+per-side borders, min/max, opacity`

---

### Task A5: Text paint — textAlign, textShadow, lineHeight

**Files:**
- Modify: `packages/primitives/src/text.ts`
- Test: `packages/primitives/test/text-paint.test.ts` (create)

- [ ] **Step 1: Write failing tests**

```ts
import { describe, it, expect } from 'vitest';
import { createRoot } from '@cairn/reactivity';
import { Text } from '../src/text';
import { recordingRenderer } from './recording-renderer';

function paintText(style: any, content = 'hi') {
  return createRoot(() => {
    const inst = Text({ style, children: content });
    inst.layout.size = { w: 80, h: 20 };
    const { r, calls } = recordingRenderer();
    inst.paintSelf(r);
    return { inst, calls };
  });
}

describe('Text paint', () => {
  it('textAlign=center anchors x at box center and sets align', () => {
    const { calls } = paintText({ textAlign: 'center' });
    const dt = calls.find((c) => c.name === 'drawText')!;
    expect(dt.args[2].align).toBe('center');
    expect(dt.args[1].x).toBe(40);
  });
  it('textAlign=right anchors x at box right', () => {
    const { calls } = paintText({ textAlign: 'right' });
    const dt = calls.find((c) => c.name === 'drawText')!;
    expect(dt.args[1].x).toBe(80);
  });
  it('textShadow wraps drawText in setShadow', () => {
    const { calls } = paintText({ textShadow: { color: '#000', blur: 1, offsetX: 0, offsetY: 1 } });
    const on = calls.findIndex((c) => c.name === 'setShadow' && c.args[0]);
    const dt = calls.findIndex((c) => c.name === 'drawText');
    expect(on).toBeGreaterThanOrEqual(0);
    expect(on).toBeLessThan(dt);
  });
  it('lineHeight centers baseline (middle)', () => {
    const { calls } = paintText({ lineHeight: 20 });
    const dt = calls.find((c) => c.name === 'drawText')!;
    expect(dt.args[2].baseline).toBe('middle');
    expect(dt.args[1].y).toBe(10);
  });
  it('opacity forwarded to paintOpacity', () => {
    const { inst } = paintText({ opacity: 0.4 });
    expect(inst.paintOpacity).toBe(0.4);
  });
});
```

- [ ] **Step 2: Run to verify failure** — FAIL.

- [ ] **Step 3: Implement** `text.ts`. Restructure so `instance` exists before `bind` (to set `paintOpacity`), and rewrite `paintSelf`:

```ts
  const instance: Instance = {
    layout,
    children: [],
    handlers,
    focusable: props.focusable,
    paintSelf(r: Renderer) {
      const s = current;
      const w = layout.size.w;
      const h = layout.size.h;
      const align = s.textAlign ?? 'left';
      const x = align === 'center' ? w / 2 : align === 'right' ? w : 0;
      const useLine = s.lineHeight != null;
      const y = useLine ? h / 2 : 0;
      if (s.textShadow) { r.save(); r.setShadow(s.textShadow); }
      r.drawText(layout.text, { x, y }, {
        font: s.font ?? '16px sans-serif',
        color: s.color ?? '#000',
        align,
        baseline: useLine ? 'middle' : 'top',
      });
      if (s.textShadow) { r.setShadow(null); r.restore(); }
    },
  };

  bind(resolved, (s) => {
    current = s;
    layout.style = { ...layout.style, font: s.font ?? '16px sans-serif' };
    instance.paintOpacity = s.opacity;
  });
  bind(content, (v) => { layout.text = String(v); });
```

(Move the `const content = ...` line above the `bind(content, ...)` call as today.)

- [ ] **Step 4: Run tests** → PASS. `pnpm typecheck`. `pnpm vitest run packages/primitives`.

- [ ] **Step 5: Commit** — `feat(primitives): Text textAlign/textShadow/lineHeight + opacity`

---

## Group B — Layout completeness

### Task B1: `margin` parent-data

**Files:**
- Modify: `packages/layout/src/node.ts` (add `margin`), `packages/layout/src/flex.ts` (account for it), `packages/layout/src/box.ts` (account for child margin)
- Modify: `packages/primitives/src/layout-child.ts` (+`margin`), `packages/style/src/style.ts` (+`margin` on BaseStyle)
- Test: `packages/layout/test/margin.test.ts` (create)

**Design:** `margin: EdgeInsets` (default all-zero) is parent-data on `LayoutNode`. In `FlexNode`, each child occupies `marginMain(before+after)` extra main space and its offset is shifted by the leading margin; cross alignment aligns the margin box (child cross size + cross margins). In `BoxNode`, the single child's margin adds to the space it needs and shifts its offset. Margins are additive (no collapsing).

- [ ] **Step 1: Write failing tests**

```ts
import { describe, it, expect } from 'vitest';
import { FlexNode } from '../src/flex';
import { BoxNode } from '../src/box';
import { LayoutNode } from '../src/node';

class Fixed extends LayoutNode {
  constructor(public w: number, public h: number) { super(); }
  layout() { this.size = { w: this.w, h: this.h }; return this.size; }
}
const ctx: any = { measureText: () => ({ width: 0 }) };

describe('margin', () => {
  it('row: leading margin shifts child, margins add to used space', () => {
    const a = new Fixed(10, 10); a.margin = { top: 0, right: 5, bottom: 0, left: 5 };
    const b = new Fixed(10, 10);
    const row = new FlexNode({ direction: 'row', children: [a, b] });
    row.layout({ minW: 0, maxW: 100, minH: 0, maxH: 100 }, ctx);
    expect(a.offsetX).toBe(5);            // leading left margin
    expect(b.offsetX).toBe(5 + 10 + 5);   // after a's box (5+10+5)
  });
  it('box: child margin insets the child and grows the box', () => {
    const c = new Fixed(10, 10); c.margin = { top: 2, right: 3, bottom: 4, left: 5 };
    const box = new BoxNode({ child: c });
    const size = box.layout({ minW: 0, maxW: 100, minH: 0, maxH: 100 }, ctx);
    expect(c.offsetX).toBe(5);
    expect(c.offsetY).toBe(2);
    expect(size.w).toBe(10 + 5 + 3);
    expect(size.h).toBe(10 + 2 + 4);
  });
});
```

- [ ] **Step 2: Run to verify failure** — FAIL (`margin` not a field; not accounted for).

- [ ] **Step 3: Implement.**
In `node.ts` add:
```ts
import type { EdgeInsets } from './box';
// ...
  margin: EdgeInsets = { top: 0, right: 0, bottom: 0, left: 0 };
```
(If importing `EdgeInsets` from `box.ts` creates a cycle, instead define `EdgeInsets` in `types.ts` and re-export from `box.ts`; do that refactor if the cycle bites.)

In `box.ts` `layout()`, account for the child's margin. Replace the `if (child)` branch:
```ts
    if (child) {
      const m = child.margin;
      const childMaxW = Math.max(0, selfMaxW - p.left - p.right - m.left - m.right);
      const childMaxH = Math.max(0, selfMaxH - p.top - p.bottom - m.top - m.bottom);
      const cs = child.layout({ minW: 0, maxW: childMaxW, minH: 0, maxH: childMaxH }, ctx);
      const outerW = cs.w + m.left + m.right;
      const outerH = cs.h + m.top + m.bottom;
      w = clamp(outerW + p.left + p.right, selfMinW, selfMaxW);
      h = clamp(outerH + p.top + p.bottom, selfMinH, selfMaxH);
      const extraX = Math.max(0, w - p.left - p.right - outerW);
      const extraY = Math.max(0, h - p.top - p.bottom - outerH);
      child.offsetX = p.left + m.left + (this.alignX === 'center' ? extraX / 2 : this.alignX === 'end' ? extraX : 0);
      child.offsetY = p.top + m.top + (this.alignY === 'center' ? extraY / 2 : this.alignY === 'end' ? extraY : 0);
    }
```

In `flex.ts`, define margin main/cross helpers and fold them into used space, content main, cross size, and placement. Add near the other helpers:
```ts
    const marginMain = (ch: LayoutNode): number => (isRow ? ch.margin.left + ch.margin.right : ch.margin.top + ch.margin.bottom);
    const marginCross = (ch: LayoutNode): number => (isRow ? ch.margin.top + ch.margin.bottom : ch.margin.left + ch.margin.right);
    const leadMain = (ch: LayoutNode): number => (isRow ? ch.margin.left : ch.margin.top);
    const leadCross = (ch: LayoutNode): number => (isRow ? ch.margin.top : ch.margin.left);
```
- In Phase 1 non-flex: `usedMain += mainSize(s) + marginMain(ch);` and `maxCross = Math.max(maxCross, crossSize(s) + marginCross(ch));`
- In Phase 2 flex share: subtract margins from the tight main extent given to the child — compute `share` from `free` where `free = Math.max(0, availMain - usedMain)` already includes margins (usedMain now has flex children's margins? No — flex children skipped Phase 1). Add flex children's margins to `usedMain` before computing `free`: after the non-flex loop, `for (const ch of flexChildren) usedMain += marginMain(ch);`. Then the child's tight main is `share` (its content), and it occupies `share + marginMain(ch)`.
  Also `maxCross = Math.max(maxCross, crossSize(s) + marginCross(ch));` for flex children.
- `contentMain`: `this.children.reduce((sum, ch) => sum + mainSize(ch.size) + marginMain(ch), 0) + gapTotal;`
- Placement loop: cross offset uses margin box; add leading margins:
```ts
    for (const ch of this.children) {
      const cs = crossSize(ch.size) + marginCross(ch);
      let crossOffset = 0;
      if (this.align === 'center') crossOffset = (ownCross - cs) / 2;
      else if (this.align === 'end') crossOffset = ownCross - cs;
      const mainStart = cursor + leadMain(ch);
      const crossStart = crossOffset + leadCross(ch);
      if (isRow) { ch.offsetX = mainStart; ch.offsetY = crossStart; }
      else { ch.offsetX = crossStart; ch.offsetY = mainStart; }
      cursor += mainSize(ch.size) + marginMain(ch) + between;
    }
```

Add `margin` to `BaseStyle` (`packages/style/src/style.ts`): `margin?: number | Partial<EdgeInsets>;` (import `EdgeInsets` type — it's already imported from `@cairn/layout`). Add to `LayoutChildProps` and `applyLayoutChildProps` in `layout-child.ts`:
```ts
  margin?: number | Partial<EdgeInsets>;
```
```ts
  if (props.margin !== undefined) inst.layout.margin = toEdgeInsets(props.margin);
```
(import `toEdgeInsets` and `EdgeInsets` from `@cairn/layout`.)

Primitives (`box.ts`, `flex.ts`) should set `layout.margin` from `style.margin` too (so margin works via `style`, not only the child prop). In each `bind(resolved, ...)`: `layout.margin = toEdgeInsets(s.margin);`.

- [ ] **Step 4: Run tests** — `pnpm vitest run packages/layout/test/margin.test.ts` → PASS. Run full layout + primitives suites; fix regressions. `pnpm typecheck`.

- [ ] **Step 5: Commit** — `feat(layout): margin parent-data in Flex and Box`

---

### Task B2: `rowGap` / `columnGap`

**Files:**
- Modify: `packages/layout/src/flex.ts` (add `rowGap`/`columnGap`, pick by direction), `packages/primitives/src/flex.ts`, `packages/style/src/style.ts`
- Test: `packages/layout/test/gaps.test.ts` (create)

**Design:** `FlexNode` gains `rowGap?: number` and `columnGap?: number`. Effective gap = `direction==='row' ? (columnGap ?? gap) : (rowGap ?? gap)` — a Row lays children left-to-right so the *between-column* gap applies; a Column uses the row gap. Compute once at the top of `layout()` into a local `gap` replacing `this.gap` usages.

- [ ] **Step 1: Write failing test**

```ts
import { describe, it, expect } from 'vitest';
import { FlexNode } from '../src/flex';
import { LayoutNode } from '../src/node';
class Fixed extends LayoutNode { constructor(public w:number,public h:number){super();} layout(){this.size={w:this.w,h:this.h};return this.size;} }
const ctx:any={measureText:()=>({width:0})};
it('row uses columnGap between children', () => {
  const a=new Fixed(10,10), b=new Fixed(10,10);
  const row=new FlexNode({direction:'row',columnGap:7,children:[a,b]});
  row.layout({minW:0,maxW:100,minH:0,maxH:100},ctx);
  expect(b.offsetX).toBe(17);
});
it('column uses rowGap between children', () => {
  const a=new Fixed(10,10), b=new Fixed(10,10);
  const col=new FlexNode({direction:'column',rowGap:9,children:[a,b]});
  col.layout({minW:0,maxW:100,minH:0,maxH:100},ctx);
  expect(b.offsetY).toBe(19);
});
```

- [ ] **Step 2: Run to verify failure** — FAIL.

- [ ] **Step 3: Implement.** Add fields to `FlexNodeProps` and `FlexNode` (`rowGap?`, `columnGap?`), assign in constructor. At the top of `layout()`:
```ts
    const gap = (isRow ? this.columnGap : this.rowGap) ?? this.gap;
```
Replace all `this.gap` uses in `layout()` with the local `gap` (`gapTotal`, `between` init, `space-between`/`space-around`).
In the primitive (`packages/primitives/src/flex.ts`) `bind`: `layout.rowGap = s.rowGap; layout.columnGap = s.columnGap;`. Add `rowGap?: number; columnGap?: number;` to `BaseStyle`.

- [ ] **Step 4: Run tests** → PASS. `pnpm typecheck`; full suites green.

- [ ] **Step 5: Commit** — `feat(layout): rowGap/columnGap on Flex`

---

### Task B3: `alignSelf`

**Files:**
- Modify: `packages/layout/src/node.ts` (+`alignSelf`), `packages/layout/src/flex.ts` (honor it), `packages/primitives/src/layout-child.ts`, `packages/style/src/style.ts`
- Test: `packages/layout/test/align-self.test.ts` (create)

**Design:** `alignSelf?: Align` parent-data. In the placement loop, per child the effective cross alignment = `ch.alignSelf ?? this.align`. `'stretch'` on a child: give it a tight cross constraint equal to `ownCross - marginCross` during layout — but children are laid out before `ownCross` is known. Simplification for v1: `alignSelf` supports `'start'|'center'|'end'` (stretch on a single child is deferred; document it). Compute crossOffset per child from the effective value.

- [ ] **Step 1: Write failing test**

```ts
import { describe, it, expect } from 'vitest';
import { FlexNode } from '../src/flex';
import { LayoutNode } from '../src/node';
class Fixed extends LayoutNode { constructor(public w:number,public h:number){super();} layout(){this.size={w:this.w,h:this.h};return this.size;} }
const ctx:any={measureText:()=>({width:0})};
it('alignSelf overrides container align on cross axis', () => {
  const a=new Fixed(10,10); // container align=start; a wants end
  a.alignSelf='end';
  const row=new FlexNode({direction:'row',align:'start',height:50,children:[a]});
  row.layout({minW:0,maxW:100,minH:0,maxH:50},ctx);
  expect(a.offsetY).toBe(40); // 50 - 10
});
```

- [ ] **Step 2: Run to verify failure** — FAIL.

- [ ] **Step 3: Implement.** Add `alignSelf?: Align` to `LayoutNode` (import `Align` type — it's declared in `flex.ts`; move `Align` to `types.ts` or import from `./flex`; simplest: declare `alignSelf?: 'start'|'center'|'end'|'stretch'` inline on the node to avoid a cycle). In the placement loop:
```ts
      const self = ch.alignSelf ?? this.align;
      let crossOffset = 0;
      if (self === 'center') crossOffset = (ownCross - cs) / 2;
      else if (self === 'end') crossOffset = ownCross - cs;
```
Add `alignSelf` to `LayoutChildProps` + `applyLayoutChildProps` (`if (props.alignSelf !== undefined) inst.layout.alignSelf = props.alignSelf;`) and to `BaseStyle`. In `Box`/`Flex`/`Text` `applyLayoutChildProps` already runs, so the prop flows through.

- [ ] **Step 4: Run tests** → PASS. `pnpm typecheck`; suites green.

- [ ] **Step 5: Commit** — `feat(layout): alignSelf cross-axis override`

---

### Task B4: `flexBasis` + `flexShrink`

**Files:**
- Modify: `packages/layout/src/node.ts` (+`flexShrink`, `flexBasis`), `packages/layout/src/flex.ts` (distribution), `packages/primitives/src/layout-child.ts`, `packages/style/src/style.ts`
- Test: `packages/layout/test/flex-shrink-basis.test.ts` (create)

**Design:**
- `flexBasis?: number` — the child's main-axis starting size before grow/shrink (overrides content). A child with `flexBasis` but `flex===0` still lays out at basis (not treated as a grow child).
- `flexShrink` (default `0`, preserving current no-shrink behavior). When total children main (with basis) exceeds available main, distribute the overflow as shrink proportional to `flexShrink` (weight by basis × shrink, like CSS, but a simple `flexShrink`-weighted split is acceptable for v1 — document the simplification).

Distribution algorithm in `layout()`:
1. Phase 1 (non-grow children, `flex===0`): lay out at `flexBasis ?? content`. If `flexBasis` set, give a tight main constraint of `flexBasis`; else loose as today. Track `usedMain` (incl. margins).
2. Compute `free = availMain - usedMain`.
3. If `free > 0` and there are grow children (`flex>0`): split `free` by `flex` (as today).
4. If `free < 0` and there are shrink children (`flexShrink>0`): reduce each shrink child's main by `overflow * (shrink_i / Σshrink)`, clamped ≥ 0, and re-layout it at the reduced tight main.

- [ ] **Step 1: Write failing tests**

```ts
import { describe, it, expect } from 'vitest';
import { FlexNode } from '../src/flex';
import { LayoutNode } from '../src/node';
class Fixed extends LayoutNode { constructor(public w:number,public h:number){super();} layout(c:any){this.size={w: Math.min(this.w, c.maxW), h:this.h};return this.size;} }
const ctx:any={measureText:()=>({width:0})};
it('flexBasis sets starting main size', () => {
  const a=new Fixed(999,10); a.flexBasis=30;
  const row=new FlexNode({direction:'row',width:100,children:[a]});
  row.layout({minW:0,maxW:100,minH:0,maxH:50},ctx);
  expect(a.size.w).toBe(30);
});
it('flexShrink shrinks children on overflow proportionally', () => {
  const a=new Fixed(80,10); a.flexShrink=1; a.flexBasis=80;
  const b=new Fixed(80,10); b.flexShrink=1; b.flexBasis=80;
  const row=new FlexNode({direction:'row',width:100,children:[a,b]}); // 160 wanted, 100 avail, overflow 60
  row.layout({minW:0,maxW:100,minH:0,maxH:50},ctx);
  expect(a.size.w).toBe(50); // 80 - 30
  expect(b.size.w).toBe(50);
});
```

- [ ] **Step 2: Run to verify failure** — FAIL.

- [ ] **Step 3: Implement** per the algorithm above. Add `flexShrink = 0;` and `flexBasis?: number;` to `LayoutNode`. Rework Phase 1/2 in `flex.ts`:
  - In Phase 1, if `ch.flexBasis != null` lay out at tight `make(ch.flexBasis, ch.flexBasis, clo, chi)`; else loose.
  - After Phase 2 grow, add a shrink pass when `free < 0`:
```ts
    if (free < 0) {
      const shrinkers = this.children.filter((ch) => ch.flexShrink > 0 && ch.flex === 0);
      const totalShrink = shrinkers.reduce((s, ch) => s + ch.flexShrink, 0);
      if (totalShrink > 0) {
        const overflow = -free;
        for (const ch of shrinkers) {
          const reduce = (overflow * ch.flexShrink) / totalShrink;
          const target = Math.max(0, mainSize(ch.size) - reduce);
          const [clo, chi] = crossRange();
          const s = ch.layout(make(target, target, clo, chi), ctx);
          maxCross = Math.max(maxCross, crossSize(s) + marginCross(ch));
        }
      }
    }
```
  Recompute `contentMain` after the shrink pass (it reads `ch.size`). Ensure ordering: shrink pass runs before `contentMain`/placement.

Add `flexShrink`, `flexBasis` to `LayoutChildProps` + `applyLayoutChildProps` + `BaseStyle`.

- [ ] **Step 4: Run tests** → PASS. Full layout + primitives suites green (watch the existing flex-grow tests). `pnpm typecheck`.

- [ ] **Step 5: Commit** — `feat(layout): flexBasis + flexShrink distribution`

---

### Task B5: `flexWrap`

**Files:**
- Modify: `packages/layout/src/flex.ts`, `packages/primitives/src/flex.ts`, `packages/style/src/style.ts`
- Test: `packages/layout/test/flex-wrap.test.ts` (create)

**Design:** `wrap?: 'nowrap' | 'wrap'` (default `'nowrap'`). When `'wrap'`: greedily pack children (with margins) into lines that fit `mainMax`; each line positioned on the main axis per `justify` independently; lines stacked on the cross axis, separated by the cross gap; each line's cross extent = max child cross (incl. margins); own cross size = sum of line cross extents + gaps. Grow/shrink is deferred inside wrapped lines for v1 (document: grow applies only in `nowrap`). Keep `nowrap` on the existing single-line path.

- [ ] **Step 1: Write failing test**

```ts
import { describe, it, expect } from 'vitest';
import { FlexNode } from '../src/flex';
import { LayoutNode } from '../src/node';
class Fixed extends LayoutNode { constructor(public w:number,public h:number){super();} layout(){this.size={w:this.w,h:this.h};return this.size;} }
const ctx:any={measureText:()=>({width:0})};
it('wrap breaks children into lines and stacks them', () => {
  const items = [new Fixed(40,10), new Fixed(40,10), new Fixed(40,10)]; // maxW 100 → 2 per line
  const row = new FlexNode({ direction:'row', wrap:'wrap', gap:0, children: items });
  row.layout({ minW:0, maxW:100, minH:0, maxH:100 }, ctx);
  expect(items[0].offsetY).toBe(0);
  expect(items[1].offsetY).toBe(0);
  expect(items[2].offsetY).toBe(10); // second line
  expect(items[2].offsetX).toBe(0);
});
```

- [ ] **Step 2: Run to verify failure** — FAIL.

- [ ] **Step 3: Implement.** Add `wrap: 'nowrap' | 'wrap'` field (default from props). At the start of `layout()`, if `this.wrap === 'wrap' && isFinite(mainMax)`, branch to a `layoutWrapped(...)` private method; else run the current algorithm. `layoutWrapped` lays out every child loose (`make(0, mainMax, clo, chi)`), packs into lines by accumulating `mainSize+marginMain+gap ≤ mainMax`, then for each line positions children along main via the existing justify logic (extract a helper `placeLine(children, lineMainStart? )`) and along cross by line offset. Own size: main = max line used-main; cross = Σ line cross + (lines-1)*cross gap. Set `this.size`.

  Keep it a separate method to avoid entangling the single-line path. Reuse `mainSize`/`crossSize`/`marginMain`/`marginCross`/`leadMain`/`leadCross` by defining them at method scope or lifting to module functions taking `isRow`.

- [ ] **Step 4: Run tests** → PASS. Full suites green. `pnpm typecheck`.

- [ ] **Step 5: Commit** — `feat(layout): flexWrap (multi-line Flex)`

---

### Task B6: Stack `right` / `bottom` / `inset`

**Files:**
- Modify: `packages/layout/src/node.ts` (+`right`,`bottom`), `packages/layout/src/stack.ts`, `packages/primitives/src/layout-child.ts` (+`right`,`bottom`,`inset`), `packages/primitives/src/stack.ts`, `packages/style/src/style.ts`
- Test: `packages/layout/test/stack-positioning.test.ts` (create)

**Design:** Add `right?: number`, `bottom?: number` parent-data. In `StackNode.layout`, resolve x: if `left` set → `x=left`; else if `right` set → `x = containerW - right - childW`; else 0. If both `left` and `right` set → child width = `containerW - left - right` (tight constraint), `x=left`. Same for y with `top`/`bottom`. `inset` is a primitive-level convenience that sets all four to the same number.

- [ ] **Step 1: Write failing test**

```ts
import { describe, it, expect } from 'vitest';
import { StackNode } from '../src/stack';
import { LayoutNode } from '../src/node';
class Fixed extends LayoutNode { constructor(public w:number,public h:number){super();} layout(c:any){this.size={w: isFinite(c.maxW)&&c.minW===c.maxW?c.maxW:this.w, h:isFinite(c.maxH)&&c.minH===c.maxH?c.maxH:this.h};return this.size;} }
const ctx:any={measureText:()=>({width:0})};
it('right positions from the right edge', () => {
  const a=new Fixed(20,10); a.right=5;
  const st=new StackNode({children:[a]});
  st.layout({minW:0,maxW:100,minH:0,maxH:100},ctx);
  expect(a.offsetX).toBe(75); // 100 - 5 - 20
});
it('left+right define width', () => {
  const a=new Fixed(999,10); a.left=10; a.right=10;
  const st=new StackNode({children:[a]});
  st.layout({minW:0,maxW:100,minH:0,maxH:100},ctx);
  expect(a.size.w).toBe(80);
  expect(a.offsetX).toBe(10);
});
```

- [ ] **Step 2: Run to verify failure** — FAIL.

- [ ] **Step 3: Implement.** Add `right?`, `bottom?` to `LayoutNode`. Rewrite `StackNode.layout` loop: first determine container size (`w`/`h` as today, but this is chicken-and-egg for right positioning — resolve container size first as `isFinite(c.maxW) ? c.maxW : <content bound>`). For right/bottom to work we need the container size; when `maxW` is finite use it. Compute per child:
```ts
    const cw = isFinite(c.maxW) ? c.maxW : c.minW;
    const chh = isFinite(c.maxH) ? c.maxH : c.minH;
    for (const ch of this.children) {
      const both = (a?: number, b?: number) => a != null && b != null;
      const tightW = both(ch.left, ch.right) ? Math.max(0, cw - ch.left! - ch.right!) : undefined;
      const tightH = both(ch.top, ch.bottom) ? Math.max(0, chh - ch.top! - ch.bottom!) : undefined;
      const s = ch.layout({
        minW: tightW ?? 0, maxW: tightW ?? c.maxW,
        minH: tightH ?? 0, maxH: tightH ?? c.maxH,
      }, ctx);
      ch.offsetX = ch.left != null ? ch.left : ch.right != null ? cw - ch.right - s.w : 0;
      ch.offsetY = ch.top != null ? ch.top : ch.bottom != null ? chh - ch.bottom - s.h : 0;
      maxRight = Math.max(maxRight, ch.offsetX + s.w);
      maxBottom = Math.max(maxBottom, ch.offsetY + s.h);
    }
```
(Keep the final `this.size` computation as today.)

Add `right?`, `bottom?`, `inset?` to `LayoutChildProps`; in `applyLayoutChildProps`, `inset` expands to all four unless a specific side is also given:
```ts
  if (props.inset !== undefined) {
    inst.layout.left = props.left ?? props.inset;
    inst.layout.top = props.top ?? props.inset;
    inst.layout.right = props.right ?? props.inset;
    inst.layout.bottom = props.bottom ?? props.inset;
  } else {
    if (props.right !== undefined) inst.layout.right = props.right;
    if (props.bottom !== undefined) inst.layout.bottom = props.bottom;
  }
```
(Keep existing `left`/`top` handling above.) Add matching fields to `BaseStyle` for completeness (`right`, `bottom`, `inset`), and have `Stack` forward them via `applyLayoutChildProps` (already called).

- [ ] **Step 4: Run tests** → PASS. Existing stack tests green. `pnpm typecheck`.

- [ ] **Step 5: Commit** — `feat(layout): Stack right/bottom/inset positioning`

---

### Task B7: `zIndex` paint + hit order

**Files:**
- Modify: `packages/layout/src/node.ts` (+`zIndex`), `packages/runtime/src/instance.ts` (paint z-order), `packages/events/src/hit-test.ts` (hit z-order), `packages/primitives/src/layout-child.ts`, `packages/style/src/style.ts`
- Test: `packages/runtime/test/z-order.test.ts` + `packages/events/test/hit-z.test.ts` (create)

**Design:** `zIndex = 0` parent-data on `LayoutNode`. Paint children in ascending `zIndex` (stable — equal z keeps document order). Hit-test iterates children in **descending** paint order (highest z first, then later document order first).

- [ ] **Step 1: Write failing tests**

Paint order:
```ts
import { describe, it, expect } from 'vitest';
import { paint, type Instance } from '../src/instance';
import { BoxNode } from '@cairn/layout';
function leaf(z: number, tag: string, log: string[]): Instance {
  const layout = new BoxNode({}); layout.size={w:1,h:1}; layout.zIndex=z;
  return { layout, children: [], paintSelf(){ log.push(tag); } };
}
it('paints children in ascending zIndex, stable for ties', () => {
  const log: string[] = [];
  const parent: Instance = { layout: Object.assign(new BoxNode({}), { size:{w:10,h:10} }),
    children: [leaf(2,'a',log), leaf(1,'b',log), leaf(1,'c',log)], paintSelf(){} };
  const r:any = new Proxy({},{get:()=>()=>{}});
  paint(parent, r);
  expect(log).toEqual(['b','c','a']);
});
```

- [ ] **Step 2: Run to verify failure** — FAIL.

- [ ] **Step 3: Implement.**
Add `zIndex = 0;` to `LayoutNode`. In `instance.ts` `paint`, order children by z before recursing:
```ts
  const ordered = orderByZ(inst.children);
  for (const child of ordered) paint(child, r, alpha);
```
```ts
function orderByZ(children: Instance[]): Instance[] {
  if (!children.some((c) => c.layout.zIndex)) return children; // fast path
  return children.map((c, i) => ({ c, i })).sort((a, b) => a.c.layout.zIndex - b.c.layout.zIndex || a.i - b.i).map((x) => x.c);
}
```
In `hit-test.ts`, iterate children in reverse of the z-ascending order (i.e., descending z, ties later-first). Replace the reverse-index loop:
```ts
  const ordered = orderByZ(node.children as HitNode[]); // ascending z, doc order for ties
  for (let i = ordered.length - 1; i >= 0; i--) {
    const hit = hitAt(ordered[i], x, y, nx, ny);
    if (hit) return [...hit, node];
  }
```
(Define a local `orderByZ` in hit-test operating on `HitNode` — `HitNode.layout` has `zIndex` since it's a `LayoutNode`. Duplicating the tiny helper is fine, or export it from a shared spot; keep it local to avoid a runtime→events dep.)

Add `zIndex` to `LayoutChildProps` + `applyLayoutChildProps` + `BaseStyle`.

- [ ] **Step 4: Run tests** → PASS both. Existing hit-test tests green. `pnpm typecheck`.

- [ ] **Step 5: Commit** — `feat(layout): zIndex paint + hit ordering`

---

### Task B8: `aspectRatio`

**Files:**
- Modify: `packages/layout/src/box.ts` (+`aspectRatio`), `packages/primitives/src/box.ts`, `packages/style/src/style.ts`
- Test: `packages/layout/test/aspect-ratio.test.ts` (create)

**Design:** `aspectRatio?: number` (= width/height) on `BoxNode`. When exactly one of width/height is determined (explicit, or a tight incoming constraint) and the other is free, derive the free one: if width known → `height = width / ratio`; if height known → `width = height * ratio`. Applies to a childless box (or a box whose content is smaller than the derived size). Keep it simple: only apply when there's no child, or after computing content size, expand to satisfy the ratio if larger.

- [ ] **Step 1: Write failing test**

```ts
import { describe, it, expect } from 'vitest';
import { BoxNode } from '../src/box';
const ctx:any={measureText:()=>({width:0})};
it('derives height from width via aspectRatio', () => {
  const box = new BoxNode({ width: 100 }); (box as any).aspectRatio = 2; // 2:1
  const s = box.layout({ minW:0, maxW:200, minH:0, maxH:200 }, ctx);
  expect(s.w).toBe(100); expect(s.h).toBe(50);
});
it('derives width from height via aspectRatio', () => {
  const box = new BoxNode({ height: 50 }); (box as any).aspectRatio = 2;
  const s = box.layout({ minW:0, maxW:200, minH:0, maxH:200 }, ctx);
  expect(s.w).toBe(100); expect(s.h).toBe(50);
});
```

- [ ] **Step 2: Run to verify failure** — FAIL.

- [ ] **Step 3: Implement.** Add `aspectRatio?: number;` to `BoxNodeProps`/`BoxNode`. After computing `w`/`h` in `layout()` (both the child and no-child branches), if `aspectRatio` set:
```ts
    if (this.aspectRatio && this.aspectRatio > 0) {
      const widthKnown = this.width != null;
      const heightKnown = this.height != null;
      if (widthKnown && !heightKnown) h = clamp(w / this.aspectRatio, selfMinH, selfMaxH);
      else if (heightKnown && !widthKnown) w = clamp(h * this.aspectRatio, selfMinW, selfMaxW);
      else if (!widthKnown && !heightKnown) h = clamp(w / this.aspectRatio, selfMinH, selfMaxH);
    }
```
Set `layout.aspectRatio = s.aspectRatio` in the `Box` primitive `bind`. Add `aspectRatio?: number` to `BaseStyle`.

- [ ] **Step 4: Run tests** → PASS. Full suites green. `pnpm typecheck`.

- [ ] **Step 5: Commit** — `feat(layout): aspectRatio on Box`

---

## Group C — Widgets

### Task C1: `cubicTo` path command + SVG path-`d` parser

**Files:**
- Modify: `packages/host/src/path.ts` (add `cubicTo`), `packages/platform-web/src/canvas2d-renderer.ts` (trace it)
- Create: `packages/primitives/src/svg-path.ts` (parser: `d` string → `Path`)
- Test: `packages/primitives/test/svg-path.test.ts` (create)

**Design:** SVG cubic beziers need a cubic path command. Add `{ type: 'cubicTo'; c1x; c1y; c2x; c2y; x; y }` to `PathCommand` + `cubicTo` to `PathBuilder`. The parser handles `M m L l H h V v C c S s Q q T t A a Z z` (arcs converted to cubic approximation or line fallback — for v1, approximate `A` with a `lineTo` to the endpoint and document the limitation; most icon sets use `M L C Q Z`).

- [ ] **Step 1: Write failing tests**

```ts
import { describe, it, expect } from 'vitest';
import { parseSvgPath } from '../src/svg-path';

describe('parseSvgPath', () => {
  it('parses absolute M L Z', () => {
    const p = parseSvgPath('M0 0 L10 0 L10 10 Z');
    expect(p.commands).toEqual([
      { type: 'moveTo', x: 0, y: 0 },
      { type: 'lineTo', x: 10, y: 0 },
      { type: 'lineTo', x: 10, y: 10 },
      { type: 'close' },
    ]);
  });
  it('handles relative m/l', () => {
    const p = parseSvgPath('m5 5 l5 0');
    expect(p.commands).toEqual([
      { type: 'moveTo', x: 5, y: 5 },
      { type: 'lineTo', x: 10, y: 5 },
    ]);
  });
  it('parses cubic C', () => {
    const p = parseSvgPath('M0 0 C1 2 3 4 5 6');
    expect(p.commands[1]).toEqual({ type: 'cubicTo', c1x: 1, c1y: 2, c2x: 3, c2y: 4, x: 5, y: 6 });
  });
  it('parses H and V', () => {
    const p = parseSvgPath('M0 0 H10 V10');
    expect(p.commands).toEqual([
      { type: 'moveTo', x: 0, y: 0 },
      { type: 'lineTo', x: 10, y: 0 },
      { type: 'lineTo', x: 10, y: 10 },
    ]);
  });
});
```

- [ ] **Step 2: Run to verify failure** — FAIL.

- [ ] **Step 3: Implement.**
Add to `path.ts`: the `cubicTo` variant in `PathCommand`, `cubicTo(...)` on `PathBuilder`, and its impl in `createPath`. In `canvas2d-renderer.ts` `tracePath`, add:
```ts
        case 'cubicTo':
          this.ctx.bezierCurveTo(cmd.c1x, cmd.c1y, cmd.c2x, cmd.c2y, cmd.x, cmd.y);
          break;
```
Create `svg-path.ts`:
```ts
import { createPath, type Path } from '@cairn/host';

// Minimal SVG path 'd' parser → Path. Supports M m L l H h V v C c S s Q q T t Z z.
// Arc (A/a) is approximated as a line to the endpoint (documented limitation).
export function parseSvgPath(d: string): Path {
  const b = createPath();
  const tokens = d.match(/[a-zA-Z]|-?\d*\.?\d+(?:e[-+]?\d+)?/gi) ?? [];
  let i = 0;
  let cx = 0, cy = 0, startX = 0, startY = 0;
  let prevC2x = 0, prevC2y = 0, prevQx = 0, prevQy = 0, lastCmd = '';
  const num = (): number => parseFloat(tokens[i++]);
  while (i < tokens.length) {
    let cmd = tokens[i];
    if (/[a-zA-Z]/.test(cmd)) i++; else cmd = implicitCmd(lastCmd);
    const rel = cmd === cmd.toLowerCase();
    const C = cmd.toUpperCase();
    switch (C) {
      case 'M': { const x = num() + (rel ? cx : 0), y = num() + (rel ? cy : 0); b.moveTo(x, y); cx = x; cy = y; startX = x; startY = y; break; }
      case 'L': { const x = num() + (rel ? cx : 0), y = num() + (rel ? cy : 0); b.lineTo(x, y); cx = x; cy = y; break; }
      case 'H': { const x = num() + (rel ? cx : 0); b.lineTo(x, cy); cx = x; break; }
      case 'V': { const y = num() + (rel ? cy : 0); b.lineTo(cx, y); cy = y; break; }
      case 'C': { const c1x=num()+(rel?cx:0),c1y=num()+(rel?cy:0),c2x=num()+(rel?cx:0),c2y=num()+(rel?cy:0),x=num()+(rel?cx:0),y=num()+(rel?cy:0); b.cubicTo(c1x,c1y,c2x,c2y,x,y); prevC2x=c2x; prevC2y=c2y; cx=x; cy=y; break; }
      case 'S': { const c1x = C==='S'&&'CS'.includes(lastCmd.toUpperCase())?2*cx-prevC2x:cx, c1y = 'CS'.includes(lastCmd.toUpperCase())?2*cy-prevC2y:cy; const c2x=num()+(rel?cx:0),c2y=num()+(rel?cy:0),x=num()+(rel?cx:0),y=num()+(rel?cy:0); b.cubicTo(c1x,c1y,c2x,c2y,x,y); prevC2x=c2x; prevC2y=c2y; cx=x; cy=y; break; }
      case 'Q': { const qx=num()+(rel?cx:0),qy=num()+(rel?cy:0),x=num()+(rel?cx:0),y=num()+(rel?cy:0); b.quadTo(qx,qy,x,y); prevQx=qx; prevQy=qy; cx=x; cy=y; break; }
      case 'T': { const qx='QT'.includes(lastCmd.toUpperCase())?2*cx-prevQx:cx, qy='QT'.includes(lastCmd.toUpperCase())?2*cy-prevQy:cy; const x=num()+(rel?cx:0),y=num()+(rel?cy:0); b.quadTo(qx,qy,x,y); prevQx=qx; prevQy=qy; cx=x; cy=y; break; }
      case 'A': { num();num();num();num();num(); const x=num()+(rel?cx:0),y=num()+(rel?cy:0); b.lineTo(x,y); cx=x; cy=y; break; }
      case 'Z': { b.close(); cx=startX; cy=startY; break; }
      default: i++; // skip unknown
    }
    lastCmd = cmd;
  }
  return b.build();
}
function implicitCmd(last: string): string {
  const u = last.toUpperCase();
  if (u === 'M') return last === 'm' ? 'l' : 'L';
  return last || 'L';
}
```
(Keep this pragmatic; the tests above lock the important cases. If a token edge case fails, adjust the regex/consumption to pass the tests — do not add features beyond the listed commands.)

- [ ] **Step 4: Run tests** → PASS. `pnpm typecheck`.

- [ ] **Step 5: Commit** — `feat(primitives): SVG path-d parser + cubic path command`

---

### Task C2: `Path` / `Svg` primitive

**Files:**
- Create: `packages/primitives/src/svg.ts` (exports `Path` component; alias `Svg`)
- Modify: `packages/primitives/src/index.ts`
- Test: `packages/primitives/test/svg.test.ts` (create)

**Design:** `Path({ d, fill?, stroke?, strokeWidth?, width, height, viewBox? })`. Renders a parsed path scaled from the viewBox (default `0 0 <width> <height>`, or `24 24` if only `d` and a `size`). Layout is a `BoxNode` with the given width/height. Paints via `fillPath`/`strokePath` inside a `save()`+`scale()`.

- [ ] **Step 1: Write failing test**

```ts
import { describe, it, expect } from 'vitest';
import { createRoot } from '@cairn/reactivity';
import { Path } from '../src/svg';
import { recordingRenderer } from './recording-renderer';
it('fills a path scaled to size', () => {
  createRoot(() => {
    const inst = Path({ d: 'M0 0 L24 0 L24 24 Z', fill: '#f00', width: 48, height: 48, viewBox: [0,0,24,24] });
    inst.layout.size = { w: 48, h: 48 };
    const { r, calls } = recordingRenderer();
    inst.paintSelf(r);
    expect(calls.some((c) => c.name === 'scale' && c.args[0] === 2 && c.args[1] === 2)).toBe(true);
    expect(calls.some((c) => c.name === 'fillPath')).toBe(true);
  });
});
```

- [ ] **Step 2: Run to verify failure** — FAIL.

- [ ] **Step 3: Implement** `svg.ts`:
```ts
import type { Renderer, FillStyle, StrokeStyle } from '@cairn/host';
import { BoxNode } from '@cairn/layout';
import type { Instance } from '@cairn/runtime';
import type { StyleGradient } from '@cairn/style';
import { parseSvgPath } from './svg-path';
import { applyLayoutChildProps, type LayoutChildProps } from './layout-child';

export interface PathProps extends LayoutChildProps {
  d: string;
  fill?: string | StyleGradient;
  stroke?: string | StyleGradient;
  strokeWidth?: number;
  width: number;
  height: number;
  viewBox?: [number, number, number, number];
}

export function Path(props: PathProps): Instance {
  const path = parseSvgPath(props.d);
  const layout = new BoxNode({ width: props.width, height: props.height });
  const vb = props.viewBox ?? [0, 0, props.width, props.height];
  const instance: Instance = {
    layout, children: [],
    paintSelf(r: Renderer) {
      const sx = props.width / (vb[2] || props.width);
      const sy = props.height / (vb[3] || props.height);
      r.save();
      r.scale(sx, sy);
      r.translate(-vb[0], -vb[1]);
      if (props.fill) r.fillPath(path, toFill(props.fill));
      if (props.stroke) r.strokePath(path, toStroke(props.stroke, props.strokeWidth));
      r.restore();
    },
  };
  applyLayoutChildProps(instance, props);
  return instance;
}
export const Svg = Path;
function toFill(v: string | StyleGradient): FillStyle { return typeof v === 'string' ? { color: v } : { gradient: v as any }; }
function toStroke(v: string | StyleGradient, width?: number): StrokeStyle { return { ...(typeof v === 'string' ? { color: v } : { gradient: v as any }), width: width ?? 1 }; }
```
Export `Path`, `Svg`, `PathProps` from `index.ts`.

- [ ] **Step 4: Run tests** → PASS. `pnpm typecheck`.

- [ ] **Step 5: Commit** — `feat(primitives): Path/Svg vector primitive`

---

### Task C3: `Icon` primitive

**Files:**
- Create: `packages/primitives/src/icon.ts`
- Modify: `packages/primitives/src/index.ts`
- Test: `packages/primitives/test/icon.test.ts` (create)

**Design:** `Icon({ path, size?, color? })` — a thin wrapper over `Path` with a 24-unit default viewBox (Lucide/Material convention) and square `size` (default 24). `path` accepts an SVG `d` string.

- [ ] **Step 1: Write failing test**

```ts
import { describe, it, expect } from 'vitest';
import { createRoot } from '@cairn/reactivity';
import { Icon } from '../src/icon';
import { recordingRenderer } from './recording-renderer';
it('renders a 24-viewbox icon scaled to size', () => {
  createRoot(() => {
    const inst = Icon({ path: 'M2 2 L22 2 L22 22 Z', size: 12, color: '#333' });
    inst.layout.size = { w: 12, h: 12 };
    const { r, calls } = recordingRenderer();
    inst.paintSelf(r);
    expect(calls.some((c) => c.name === 'scale' && c.args[0] === 0.5)).toBe(true);
    expect(calls.some((c) => c.name === 'fillPath')).toBe(true);
  });
});
```

- [ ] **Step 2: Run to verify failure** — FAIL.

- [ ] **Step 3: Implement** `icon.ts`:
```ts
import type { Instance } from '@cairn/runtime';
import { Path } from './svg';
import type { LayoutChildProps } from './layout-child';

export interface IconProps extends LayoutChildProps {
  path: string;
  size?: number;
  color?: string;
}
export function Icon(props: IconProps): Instance {
  const size = props.size ?? 24;
  return Path({
    d: props.path, fill: props.color ?? '#000',
    width: size, height: size, viewBox: [0, 0, 24, 24],
    flex: props.flex, left: props.left, top: props.top, margin: props.margin,
  });
}
```
Export from `index.ts`.

- [ ] **Step 4: Run tests** → PASS. `pnpm typecheck`.

- [ ] **Step 5: Commit** — `feat(primitives): Icon primitive`

---

### Task C4: `Image` primitive (objectFit)

**Files:**
- Create: `packages/primitives/src/image.ts` (+ a pure `computeObjectFit` helper)
- Modify: `packages/primitives/src/index.ts`
- Test: `packages/primitives/test/image.test.ts` (create)

**Design:** `Image({ src, width, height, objectFit? })`. `src: ImageHandle` (has `width`/`height`). `computeObjectFit(fit, dest, natural)` returns `{ src, dest }` rects. `fill` (default): stretch to dest. `contain`: fit inside, letterbox (dest shrinks, centered). `cover`: fill dest, crop src. `none`: natural size centered, crop if larger.

- [ ] **Step 1: Write failing tests** (focus on the pure helper — deterministic math)

```ts
import { describe, it, expect } from 'vitest';
import { computeObjectFit } from '../src/image';
const dest = { x: 0, y: 0, width: 100, height: 100 };
const nat = { w: 200, h: 100 }; // 2:1
describe('computeObjectFit', () => {
  it('fill stretches to dest, full src', () => {
    const r = computeObjectFit('fill', dest, nat);
    expect(r.dest).toEqual(dest);
    expect(r.src).toEqual({ x: 0, y: 0, width: 200, height: 100 });
  });
  it('contain letterboxes centered', () => {
    const r = computeObjectFit('contain', dest, nat); // 2:1 into 1:1 → 100x50 centered
    expect(r.dest).toEqual({ x: 0, y: 25, width: 100, height: 50 });
    expect(r.src).toEqual({ x: 0, y: 0, width: 200, height: 100 });
  });
  it('cover crops src to fill dest', () => {
    const r = computeObjectFit('cover', dest, nat); // crop width to 100 of src (centered)
    expect(r.dest).toEqual(dest);
    expect(r.src).toEqual({ x: 50, y: 0, width: 100, height: 100 });
  });
});
```

- [ ] **Step 2: Run to verify failure** — FAIL.

- [ ] **Step 3: Implement** `image.ts`:
```ts
import type { Renderer, Rect, ImageHandle } from '@cairn/host';
import { BoxNode } from '@cairn/layout';
import type { Instance } from '@cairn/runtime';
import { applyLayoutChildProps, type LayoutChildProps } from './layout-child';

export type ObjectFit = 'fill' | 'contain' | 'cover' | 'none';

export function computeObjectFit(fit: ObjectFit, dest: Rect, natural: { w: number; h: number }): { src: Rect; dest: Rect } {
  const fullSrc = { x: 0, y: 0, width: natural.w, height: natural.h };
  if (fit === 'fill') return { src: fullSrc, dest };
  if (fit === 'contain') {
    const scale = Math.min(dest.width / natural.w, dest.height / natural.h);
    const w = natural.w * scale, h = natural.h * scale;
    return { src: fullSrc, dest: { x: dest.x + (dest.width - w) / 2, y: dest.y + (dest.height - h) / 2, width: w, height: h } };
  }
  if (fit === 'cover') {
    const scale = Math.max(dest.width / natural.w, dest.height / natural.h);
    const sw = dest.width / scale, sh = dest.height / scale;
    return { src: { x: (natural.w - sw) / 2, y: (natural.h - sh) / 2, width: sw, height: sh }, dest };
  }
  // none: natural size centered, cropped to dest
  const sw = Math.min(natural.w, dest.width), sh = Math.min(natural.h, dest.height);
  const dw = sw, dh = sh;
  return {
    src: { x: (natural.w - sw) / 2, y: (natural.h - sh) / 2, width: sw, height: sh },
    dest: { x: dest.x + (dest.width - dw) / 2, y: dest.y + (dest.height - dh) / 2, width: dw, height: dh },
  };
}

export interface ImageProps extends LayoutChildProps {
  src: ImageHandle;
  width: number;
  height: number;
  objectFit?: ObjectFit;
}
export function Image(props: ImageProps): Instance {
  const layout = new BoxNode({ width: props.width, height: props.height });
  const instance: Instance = {
    layout, children: [],
    paintSelf(r: Renderer) {
      const { src, dest } = computeObjectFit(
        props.objectFit ?? 'fill',
        { x: 0, y: 0, width: layout.size.w, height: layout.size.h },
        { w: props.src.width, h: props.src.height },
      );
      r.drawImage(props.src, dest, src);
    },
  };
  applyLayoutChildProps(instance, props);
  return instance;
}
```
Export `Image`, `ImageProps`, `ObjectFit`, `computeObjectFit` from `index.ts`.

- [ ] **Step 4: Run tests** → PASS. `pnpm typecheck`.

- [ ] **Step 5: Commit** — `feat(primitives): Image primitive with objectFit`

---

### Task C5: `@cairn/widgets` package + `Divider`

**Files:**
- Create: `packages/widgets/package.json`, `packages/widgets/tsconfig.json`, `packages/widgets/src/index.ts`, `packages/widgets/src/divider.ts`
- Create: `packages/widgets/test/divider.test.ts`
- Modify: root `tsconfig`/workspace refs if the repo uses project references (mirror an existing package's `tsconfig.json` and `package.json` exactly)

- [ ] **Step 1: Scaffold the package.** Copy `packages/primitives/package.json` → `packages/widgets/package.json`, rename to `@cairn/widgets`, set dependencies to `@cairn/reactivity`, `@cairn/host`, `@cairn/layout`, `@cairn/runtime`, `@cairn/style`, `@cairn/events`, `@cairn/primitives` (match version style used in the repo — `workspace:*`). Copy `packages/primitives/tsconfig.json` → `packages/widgets/tsconfig.json`, adjusting `references` to the packages above. Run `pnpm install` so the workspace links it.

- [ ] **Step 2: Write failing test** `packages/widgets/test/divider.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { createRoot } from '@cairn/reactivity';
import { Divider } from '../src/divider';
import { recordingRenderer } from '@cairn/primitives/test/recording-renderer';

it('horizontal divider is a thin full-width box', () => {
  createRoot(() => {
    const inst = Divider({ orientation: 'horizontal', thickness: 2, color: '#ccc' });
    const n = inst.layout as any;
    expect(n.height).toBe(2);
    inst.layout.size = { w: 100, h: 2 };
    const { r, calls } = recordingRenderer();
    inst.paintSelf(r);
    expect(calls.some((c) => c.name === 'fillRoundRect' && c.args[2].color === '#ccc')).toBe(true);
  });
});
```
(If importing across package test dirs is awkward, copy `recording-renderer.ts` into `packages/widgets/test/` — small duplication is acceptable.)

- [ ] **Step 3: Run to verify failure** — FAIL.

- [ ] **Step 4: Implement** `divider.ts` using `Box`:
```ts
import type { Instance } from '@cairn/runtime';
import { Box } from '@cairn/primitives';

export interface DividerProps {
  orientation?: 'horizontal' | 'vertical';
  thickness?: number;
  color?: string;
  length?: number; // optional fixed length on the main axis
}
export function Divider(props: DividerProps = {}): Instance {
  const t = props.thickness ?? 1;
  const color = props.color ?? '#e5e7eb';
  const horizontal = (props.orientation ?? 'horizontal') === 'horizontal';
  return Box({
    style: horizontal
      ? { height: t, width: props.length, backgroundColor: color }
      : { width: t, height: props.length, backgroundColor: color },
  });
}
```
Export from `packages/widgets/src/index.ts`.

- [ ] **Step 5: Run tests** — `pnpm vitest run packages/widgets` → PASS. `pnpm typecheck`.

- [ ] **Step 6: Commit** — `feat(widgets): package scaffold + Divider`

---

### Task C6: `Button` widget

**Files:**
- Create: `packages/widgets/src/button.ts`, `packages/widgets/test/button.test.ts`
- Modify: `packages/widgets/src/index.ts`

**Design:** `Button({ label?, children?, variant?, disabled?, onClick, style? })`. Renders a `Box` (alignX/alignY center) containing a `Text` (or children). Uses `createInteractive` state styling from `@cairn/primitives` (import `createInteractive`), merging variant base styles + user `style`. Focusable; Enter/Space triggers `onClick` (unless disabled). Disabled blocks `onClick` and applies the `disabled` state.

- [ ] **Step 1: Write failing tests**

```ts
import { describe, it, expect } from 'vitest';
import { createRoot } from '@cairn/reactivity';
import { Button } from '../src/button';

it('calls onClick when clicked', () => {
  createRoot(() => {
    let clicked = 0;
    const inst = Button({ label: 'OK', onClick: () => clicked++ });
    inst.handlers!.onClick!({} as any);
    expect(clicked).toBe(1);
  });
});
it('disabled blocks onClick', () => {
  createRoot(() => {
    let clicked = 0;
    const inst = Button({ label: 'OK', disabled: true, onClick: () => clicked++ });
    inst.handlers!.onClick?.({} as any);
    expect(clicked).toBe(0);
  });
});
it('Enter key triggers onClick', () => {
  createRoot(() => {
    let clicked = 0;
    const inst = Button({ label: 'OK', onClick: () => clicked++ });
    inst.handlers!.onKeyDown!({ key: 'Enter' } as any);
    expect(clicked).toBe(1);
  });
});
it('is focusable', () => {
  createRoot(() => {
    expect(Button({ label: 'OK', onClick() {} }).focusable).toBe(true);
  });
});
```

- [ ] **Step 2: Run to verify failure** — FAIL.

- [ ] **Step 3: Implement** `button.ts`:
```ts
import type { Instance } from '@cairn/runtime';
import { Box, Text, type StyleInput } from '@cairn/primitives';
import type { Style } from '@cairn/style';

export interface ButtonProps {
  label?: string;
  children?: Instance;
  variant?: 'primary' | 'secondary' | 'ghost';
  disabled?: boolean;
  onClick?: () => void;
  style?: StyleInput;
}

const VARIANTS: Record<string, Style> = {
  primary: { backgroundColor: '#4577e6', color: '#fff', hover: { backgroundColor: '#5482ea' }, pressed: { backgroundColor: '#3f6ad0' }, disabled: { backgroundColor: '#9db4e8', color: '#eef2ff' } },
  secondary: { backgroundColor: '#2a2a2c', color: '#e5e7eb', border: { width: 1, color: '#3a3a3e' }, hover: { backgroundColor: '#333336' }, disabled: { backgroundColor: '#1f1f21', color: '#6b7280' } },
  ghost: { backgroundColor: '#00000000', color: '#d1d5db', hover: { backgroundColor: '#ffffff14' }, disabled: { color: '#6b7280' } },
};

export function Button(props: ButtonProps): Instance {
  const variant = VARIANTS[props.variant ?? 'primary'];
  const base: Style = { paddingX: undefined as never, ...{ padding: { top: 10, bottom: 10, left: 16, right: 16 } }, borderRadius: 12, alignX: 'center', alignY: 'center' };
  const styles: StyleInput = [base, variant, ...(normalizeStyle(props.style))];
  const activate = (): void => { if (!props.disabled) props.onClick?.(); };
  const box = Box({
    style: styles,
    focusable: true,
    onClick: () => activate(),
    onKeyDown: (e) => { if (e.key === 'Enter' || e.key === ' ') activate(); },
    children: props.children ?? Text({ style: { color: (variant as any).color }, children: props.label ?? '' }),
  });
  return box;
}
function normalizeStyle(s?: StyleInput): Style[] {
  if (s == null) return [];
  if (typeof s === 'function') return []; // function styles not merged in v1 (documented)
  return Array.isArray(s) ? (s as Style[]) : [s as Style];
}
```
(Note: `disabled` must propagate to the resolved-state machinery. Since `createInteractive` doesn't track a `disabled` signal, apply the disabled variant directly: when `props.disabled`, append `variant.disabled` as a flat override to `styles`. Add: `if (props.disabled && variant.disabled) styles.push(variant.disabled as Style);` after building `styles`. Keep `onClick` guarded by `activate`.) Fix `base` to not include the bogus `paddingX` line — just `{ padding: { top:10,bottom:10,left:16,right:16 }, borderRadius: 12, alignX:'center', alignY:'center' }`.

- [ ] **Step 4: Run tests** → PASS. `pnpm typecheck`.

- [ ] **Step 5: Commit** — `feat(widgets): Button (variants, disabled, keyboard)`

---

### Task C7: `Checkbox` widget

**Files:**
- Create: `packages/widgets/src/checkbox.ts`, `packages/widgets/test/checkbox.test.ts`
- Modify: `packages/widgets/src/index.ts`

**Design:** `Checkbox({ checked?, defaultChecked?, onChange?, disabled?, label? })`. Controlled when `checked` is a signal-getter/value + `onChange`; uncontrolled otherwise via an internal signal. Renders a `Row`: a box (with `Icon` check when checked) + optional label `Text`. Click/Space toggles (unless disabled). Focusable.

- [ ] **Step 1: Write failing tests**

```ts
import { describe, it, expect } from 'vitest';
import { createRoot, createSignal } from '@cairn/reactivity';
import { Checkbox } from '../src/checkbox';

it('uncontrolled toggles internal state on click', () => {
  createRoot(() => {
    const seen: boolean[] = [];
    const inst = Checkbox({ defaultChecked: false, onChange: (v) => seen.push(v) });
    inst.handlers!.onClick!({} as any);
    expect(seen).toEqual([true]);
  });
});
it('controlled reflects the provided value and reports intent', () => {
  createRoot(() => {
    const [checked, setChecked] = createSignal(false);
    const seen: boolean[] = [];
    const inst = Checkbox({ checked, onChange: (v) => { seen.push(v); setChecked(v); } });
    inst.handlers!.onClick!({} as any);
    expect(seen).toEqual([true]);
    expect(checked()).toBe(true);
  });
});
it('disabled does not toggle', () => {
  createRoot(() => {
    const seen: boolean[] = [];
    const inst = Checkbox({ defaultChecked: false, disabled: true, onChange: (v) => seen.push(v) });
    inst.handlers!.onClick?.({} as any);
    expect(seen).toEqual([]);
  });
});
```

- [ ] **Step 2: Run to verify failure** — FAIL.

- [ ] **Step 3: Implement** `checkbox.ts`. Use the controlled/uncontrolled pattern from `Input` (see `packages/primitives/src/input.ts` and `resolve-input.ts` — the Input already solves controlled vs uncontrolled; mirror it). Key logic:
```ts
import type { Instance } from '@cairn/runtime';
import { createSignal, type Accessor } from '@cairn/reactivity';
import { Row, Box, Text, Icon } from '@cairn/primitives';

export interface CheckboxProps {
  checked?: boolean | Accessor<boolean>;
  defaultChecked?: boolean;
  onChange?: (v: boolean) => void;
  disabled?: boolean;
  label?: string;
}
const CHECK = 'M20 6L9 17l-5-5';
export function Checkbox(props: CheckboxProps): Instance {
  const controlled = props.checked !== undefined;
  const read: Accessor<boolean> = controlled
    ? (typeof props.checked === 'function' ? (props.checked as Accessor<boolean>) : () => props.checked as boolean)
    : (() => internal());
  const [internal, setInternal] = createSignal(props.defaultChecked ?? false);
  const toggle = (): void => {
    if (props.disabled) return;
    const next = !read();
    if (!controlled) setInternal(next);
    props.onChange?.(next);
  };
  const boxInst = Box({
    style: { width: 20, height: 20, borderRadius: 4, border: { width: 2, color: '#6b7280' }, alignX: 'center', alignY: 'center' },
    children: Icon({ path: CHECK, size: 16, color: '#4577e6' }), // v1: always mounted; visual toggle refinement later
  });
  const children = props.label
    ? [boxInst, Text({ style: { color: '#e5e7eb', lineHeight: 20 }, children: props.label })]
    : [boxInst];
  const row = Row({
    style: { gap: 8, align: 'center' }, focusable: true,
    onClick: () => toggle(),
    onKeyDown: (e) => { if (e.key === ' ' || e.key === 'Enter') toggle(); },
    children,
  });
  return row;
}
```
(The tests only assert the toggle/onChange contract, not the check-mark visibility. Reactive show/hide of the check mark can use `Show` from `@cairn/runtime` — wire it if straightforward; otherwise leave the mark always-on as a documented v1 limitation. Prefer `Show` if it composes cleanly here.)

Verify the actual `Accessor` type name exported by `@cairn/reactivity` (grep it) and use the correct name; if it's not `Accessor`, use `() => boolean`.

- [ ] **Step 4: Run tests** → PASS. `pnpm typecheck`.

- [ ] **Step 5: Commit** — `feat(widgets): Checkbox (controlled/uncontrolled, keyboard)`

---

### Task C8: `Switch` widget

**Files:**
- Create: `packages/widgets/src/switch.ts`, `packages/widgets/test/switch.test.ts`
- Modify: `packages/widgets/src/index.ts`

**Design:** Same controlled/uncontrolled contract as Checkbox. Renders a `Stack`: a rounded track `Box` + a positioned thumb `Box` whose `left` reflects on/off. Toggle on click/Space; focusable; disabled blocks.

- [ ] **Step 1: Write failing tests** (mirror Checkbox's contract tests, renaming `checked`→`value`, `defaultChecked`→`defaultValue`).

```ts
import { describe, it, expect } from 'vitest';
import { createRoot } from '@cairn/reactivity';
import { Switch } from '../src/switch';
it('uncontrolled toggles on click', () => {
  createRoot(() => {
    const seen: boolean[] = [];
    const inst = Switch({ defaultValue: false, onChange: (v) => seen.push(v) });
    inst.handlers!.onClick!({} as any);
    expect(seen).toEqual([true]);
  });
});
it('disabled does not toggle', () => {
  createRoot(() => {
    const seen: boolean[] = [];
    const inst = Switch({ defaultValue: false, disabled: true, onChange: (v) => seen.push(v) });
    inst.handlers!.onClick?.({} as any);
    expect(seen).toEqual([]);
  });
});
```

- [ ] **Step 2: Run to verify failure** — FAIL.

- [ ] **Step 3: Implement** `switch.ts` mirroring the Checkbox controlled/uncontrolled logic, with a `Stack` track+thumb. Toggle handler identical. Track width 44, height 24, thumb 20 with `left` 2 (off) / 22 (on) — a reactive `bind`/`Show` may drive the thumb position; for v1 the contract tests don't assert visuals, so a static thumb is acceptable but prefer reactive `left` if it composes. Focusable, Space/Enter toggles.

- [ ] **Step 4: Run tests** → PASS. `pnpm typecheck`.

- [ ] **Step 5: Commit** — `feat(widgets): Switch (controlled/uncontrolled, keyboard)`

---

### Task C9: `Slider` widget

**Files:**
- Create: `packages/widgets/src/slider.ts`, `packages/widgets/test/slider.test.ts`
- Modify: `packages/widgets/src/index.ts`

**Design:** Promote the counter example's bespoke slider into a reusable widget. `Slider({ value, min, max, step?, width, onChange, disabled? })` where `value` is an `Accessor<number>` (or number). Custom-painted track/fill/handle (raw `Instance` with `paintSelf`, a `BoxNode` layout of `width`×24). Click-to-set + drag via `localX`. Focusable; ArrowLeft/Right adjust by `step` (default 1). Disabled blocks all interaction.

- [ ] **Step 1: Write failing tests** (logic: value mapping + keyboard + disabled)

```ts
import { describe, it, expect } from 'vitest';
import { createRoot } from '@cairn/reactivity';
import { Slider } from '../src/slider';
it('pointer sets value from localX', () => {
  createRoot(() => {
    let v = 0;
    const inst = Slider({ value: () => v, min: 0, max: 100, width: 100, onChange: (n) => (v = n) });
    inst.handlers!.onPointerDown!({ localX: 50 } as any);
    expect(v).toBe(50);
  });
});
it('ArrowRight increments by step', () => {
  createRoot(() => {
    let v = 10;
    const inst = Slider({ value: () => v, min: 0, max: 100, step: 5, width: 100, onChange: (n) => (v = n) });
    inst.handlers!.onKeyDown!({ key: 'ArrowRight' } as any);
    expect(v).toBe(15);
  });
});
it('disabled ignores pointer', () => {
  createRoot(() => {
    let v = 0;
    const inst = Slider({ value: () => v, min: 0, max: 100, width: 100, disabled: true, onChange: (n) => (v = n) });
    inst.handlers!.onPointerDown?.({ localX: 50 } as any);
    expect(v).toBe(0);
  });
});
```

- [ ] **Step 2: Run to verify failure** — FAIL.

- [ ] **Step 3: Implement** `slider.ts` adapting the counter's Slider (see `examples/counter/main.tsx`), adding `step`, keyboard, disabled, focusable, and reading `value` as an accessor. Clamp values to `[min,max]` and round to the nearest step.

- [ ] **Step 4: Run tests** → PASS. `pnpm typecheck`.

- [ ] **Step 5: Commit** — `feat(widgets): Slider (drag, keyboard, step)`

---

### Task C10: Counter example refactor + flip doc rows

**Files:**
- Modify: `examples/counter/main.tsx`, `examples/counter/vite.config.ts` (add `@cairn/widgets` alias)
- Modify: `docs/styling-and-capabilities.md` (flip shipped rows to ✅, update snapshot)

- [ ] **Step 1: Add the widgets alias** to `examples/counter/vite.config.ts`: `'@cairn/widgets': resolve(__dirname, '../../packages/widgets/src')` (mirror the existing `@cairn/*` alias entries).

- [ ] **Step 2: Refactor `main.tsx`** to import `Button`, `Slider`, `Divider` from `@cairn/widgets`, delete the local `Button`/`Slider` helpers, add a `boxShadow` + `backgroundGradient` on the card, and add a `Divider` above the reset button. Add a `Checkbox`/`Switch` demo row if it fits the layout. Keep it compiling and visually equivalent-or-better.

- [ ] **Step 3: Verify build + run.** `pnpm typecheck`. Start the example (`pnpm --filter <counter> dev` or the repo's example script) and open it. Then use Playwright to verify: number increments on `+`, `−` clamps at 0, slider drags, checkbox/switch toggle, focus ring on Tab. Capture a screenshot.

- [ ] **Step 4: Flip the doc.** In `docs/styling-and-capabilities.md`, change to ✅ every row shipped by this plan: boxShadow, textShadow, backgroundGradient, per-corner borderRadius, per-side borders, borderStyle, opacity, textAlign, lineHeight, min/max sizes, margin, rowGap/columnGap, alignSelf, flexShrink/flexBasis, flexWrap, right/bottom/inset, zIndex, aspectRatio, Image+objectFit, Icon, Svg/Path, and add Button/Slider/Checkbox/Switch/Divider to the primitive/widget inventory. Update the "Текущий набор" snapshot (new `@cairn/widgets` package; expanded `BaseStyle` field list). Leave genuinely-deferred rows (multiline text, scroll, overlays, animation, gestures, Grid, live theme/units, a11y, perf, routing, i18n, filter, boxSizing, full SVG) as ❌/🟡 with their phase notes.

- [ ] **Step 5: Run full suite** — `pnpm vitest run` (whole workspace) + `pnpm typecheck`. All green.

- [ ] **Step 6: Commit** — `feat(examples): counter on @cairn/widgets + shadow/gradient; docs: flip shipped capability rows`

---

## Final review

- [ ] Dispatch a final code-reviewer over the whole branch diff (spec: `docs/superpowers/specs/2026-07-03-cairn-styling-widgets-layout-design.md`).
- [ ] `pnpm vitest run` and `pnpm typecheck` green across the workspace.
- [ ] Use superpowers:finishing-a-development-branch to open/merge the PR.

---

## Self-review notes (author)

- **Spec coverage:** Group A rows (shadow/gradient/per-corner+per-side border/opacity/textAlign/lineHeight/min-max) → A1–A5. Group B (margin/gaps/alignSelf/shrink+basis/wrap/right-bottom-inset/zIndex/aspectRatio) → B1–B8. Group C (Image/Icon/Svg/Button/Slider/Checkbox/Switch/Divider) → C1–C9; example + doc flip → C10. All spec items mapped.
- **Deferred-with-reason (documented v1 simplifications, not gaps):** `alignSelf: 'stretch'` on a single child (B3), grow/shrink inside wrapped lines (B5), SVG arc `A` approximated as a line (C1), rounded-rect image clip (spec noted), function-form `style` merge in widgets (C6), reactive check-mark/thumb visibility if `Show` doesn't compose cleanly (C7/C8). Each is called out in its task.
- **Type consistency:** `Shadow`/`CornerRadius`/`BorderSide`/`StyleGradient` defined in A3 and reused in A4/A5/C2; `paintOpacity` defined in A2, set in A4/A5; `margin: EdgeInsets` on the node (B1) reused by B-tasks; `Accessor` name to be verified against `@cairn/reactivity` before use (noted in C7).
- **Placeholder scan:** no TBD/TODO; each code step carries real code. Widget tasks assert behavioral contracts (onChange/keyboard/disabled), not pixels, matching the project's test style.
