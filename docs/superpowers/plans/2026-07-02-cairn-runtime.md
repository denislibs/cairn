# @cairn/runtime + @cairn/primitives Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tie reactivity + layout + rendering into a live app: a runtime that builds an instance tree from JSX, binds signals reactively, and drives full-frame re-layout + repaint through the Host — plus Box/Text/Row/Column primitives and a `mount` entry point. Milestone M3 (reactive counter on canvas).

**Architecture:** SolidJS-style — component functions run once and return an `Instance` (has-a `LayoutNode` + `paintSelf` + children). Function-valued props/children are reactive (wrapped in `createEffect`). Any change schedules one coalesced rAF frame that re-lays-out from the root and repaints the whole surface. No custom JSX compiler (automatic runtime; `type(props)`).

**Tech Stack:** TypeScript (strict, `lib: ES2022`, no DOM in core packages), pnpm workspaces, Vitest. `@cairn/runtime` depends on reactivity+layout+host; `@cairn/primitives` on runtime+layout+host.

---

## File Structure

```
package.json                          # MODIFY: typecheck adds runtime + primitives
packages/runtime/
  package.json                        # deps: reactivity, layout, host
  tsconfig.json
  src/
    instance.ts                       # Instance interface + paint(inst, r) walk
    scheduler.ts                      # module frame requester: setFrameRequester/scheduleFrame
    reactive-props.ts                 # bind(value|fn, apply)
    jsx-runtime.ts                    # jsx/jsxs/Fragment
    mount.ts                          # mount(component, host)
    index.ts
  test/
    fake-host.ts                      # recording Renderer + capturing FrameScheduler + Metrics
    instance.test.ts
    reactive-props.test.ts
    jsx-runtime.test.ts
    mount.test.ts
packages/primitives/
  package.json                        # deps: runtime, layout, host
  tsconfig.json
  src/
    box.ts                            # Box
    text.ts                           # Text
    flex.ts                           # Row / Column
    index.ts
  test/
    fake.ts                           # fake renderer + host + layout ctx for primitives
    box.test.ts
    text.test.ts
    flex.test.ts
    counter.test.ts                   # end-to-end reactive counter under a fake host
examples/counter/
  index.html
  main.tsx
  vite.config.ts
```

---

## Task 1: @cairn/runtime scaffold + Instance + paint walk

**Files:**
- Create: `packages/runtime/package.json`, `packages/runtime/tsconfig.json`
- Create: `packages/runtime/src/instance.ts`, `packages/runtime/src/index.ts`
- Create: `packages/runtime/test/fake-host.ts`
- Modify: `package.json` (root typecheck)
- Test: `packages/runtime/test/instance.test.ts`

- [ ] **Step 1: Create the test fake host**

`packages/runtime/test/fake-host.ts`:
```ts
import type { Renderer, FrameScheduler, SurfaceMetrics, Host } from '@cairn/host';

export function createFakeRenderer(): Renderer & { calls: unknown[][] } {
  const calls: unknown[][] = [];
  const rec = (name: string) => (...args: unknown[]) => {
    calls.push([name, ...args]);
  };
  const r = {
    calls,
    resize: rec('resize'),
    beginFrame: rec('beginFrame'),
    endFrame: rec('endFrame'),
    clear: rec('clear'),
    save: rec('save'),
    restore: rec('restore'),
    translate: rec('translate'),
    scale: rec('scale'),
    clipRect: rec('clipRect'),
    setShadow: rec('setShadow'),
    fillRect: rec('fillRect'),
    strokeRect: rec('strokeRect'),
    fillRoundRect: rec('fillRoundRect'),
    strokeRoundRect: rec('strokeRoundRect'),
    fillPath: rec('fillPath'),
    strokePath: rec('strokePath'),
    drawText: rec('drawText'),
    measureText: (text: string) => {
      calls.push(['measureText', text]);
      return { width: text.length * 7 };
    },
    drawImage: rec('drawImage'),
  };
  return r as unknown as Renderer & { calls: unknown[][] };
}

export function createFakeScheduler() {
  const pending: Array<() => void> = [];
  const scheduler: FrameScheduler = {
    requestFrame(cb) {
      pending.push(() => cb(0));
      return pending.length;
    },
    cancelFrame() {},
  };
  return {
    scheduler,
    pending,
    flush() {
      const q = pending.splice(0);
      for (const f of q) f();
    },
  };
}

export function createFakeMetrics(width = 200, height = 100) {
  const subs: Array<(m: SurfaceMetrics) => void> = [];
  const m = {
    width,
    height,
    devicePixelRatio: 1,
    onResize(cb: (m: SurfaceMetrics) => void) {
      subs.push(cb);
      return () => {};
    },
    dispose() {},
  };
  return {
    metrics: m as SurfaceMetrics,
    resize(w: number, h: number) {
      m.width = w;
      m.height = h;
      subs.forEach((s) => s(m as SurfaceMetrics));
    },
  };
}

export function createFakeHost() {
  const renderer = createFakeRenderer();
  const scheduler = createFakeScheduler();
  const metrics = createFakeMetrics();
  const host: Host = {
    renderer,
    scheduler: scheduler.scheduler,
    metrics: metrics.metrics,
  };
  return { host, renderer, scheduler, metrics };
}
```

- [ ] **Step 2: Write the failing test**

`packages/runtime/test/instance.test.ts`:
```ts
import { test, expect } from 'vitest';
import { BoxNode } from '@cairn/layout';
import { paint, type Instance } from '../src/index';
import { createFakeRenderer } from './fake-host';

// Build an instance backed by a real layout node with a known offset.
function node(offsetX: number, offsetY: number, marker: string, children: Instance[] = []): Instance {
  const layout = new BoxNode({ width: 10, height: 10 });
  layout.offsetX = offsetX;
  layout.offsetY = offsetY;
  return {
    layout,
    children,
    paintSelf(r) {
      r.fillRect({ x: 0, y: 0, width: 10, height: 10 }, { color: marker });
    },
  };
}

test('paint walks the tree: save/translate/paintSelf/recurse/restore', () => {
  const child = node(3, 4, 'child');
  const root = node(0, 0, 'root', [child]);
  const r = createFakeRenderer();
  paint(root, r);
  expect(r.calls).toEqual([
    ['save'],
    ['translate', 0, 0],
    ['fillRect', { x: 0, y: 0, width: 10, height: 10 }, { color: 'root' }],
    ['save'],
    ['translate', 3, 4],
    ['fillRect', { x: 0, y: 0, width: 10, height: 10 }, { color: 'child' }],
    ['restore'],
    ['restore'],
  ]);
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `pnpm vitest run packages/runtime/test/instance.test.ts`
Expected: FAIL — cannot resolve `../src/index`.

- [ ] **Step 4: Create the package + instance module**

`packages/runtime/package.json`:
```json
{
  "name": "@cairn/runtime",
  "version": "0.0.0",
  "type": "module",
  "main": "./src/index.ts",
  "module": "./src/index.ts",
  "types": "./src/index.ts",
  "exports": {
    ".": "./src/index.ts",
    "./jsx-runtime": "./src/jsx-runtime.ts"
  },
  "sideEffects": false,
  "dependencies": {
    "@cairn/reactivity": "workspace:*",
    "@cairn/layout": "workspace:*",
    "@cairn/host": "workspace:*"
  }
}
```

`packages/runtime/tsconfig.json`:
```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist"
  },
  "include": ["src", "test"]
}
```

`packages/runtime/src/instance.ts`:
```ts
import type { Renderer } from '@cairn/host';
import type { LayoutNode } from '@cairn/layout';

export interface Instance {
  layout: LayoutNode;
  paintSelf(r: Renderer): void;
  children: Instance[];
}

// Walk the instance tree, translating into each node's local coordinate space.
export function paint(inst: Instance, r: Renderer): void {
  r.save();
  r.translate(inst.layout.offsetX, inst.layout.offsetY);
  inst.paintSelf(r);
  for (const child of inst.children) paint(child, r);
  r.restore();
}
```

`packages/runtime/src/index.ts`:
```ts
export type { Instance } from './instance';
export { paint } from './instance';
```

- [ ] **Step 5: Update root typecheck + install**

Modify root `package.json` `scripts.typecheck` to append the runtime project:
```json
    "typecheck": "tsc --noEmit -p packages/reactivity/tsconfig.json && tsc --noEmit -p packages/host/tsconfig.json && tsc --noEmit -p packages/platform-web/tsconfig.json && tsc --noEmit -p packages/layout/tsconfig.json && tsc --noEmit -p packages/runtime/tsconfig.json"
```

Run: `pnpm install`
Expected: no errors; workspace deps symlinked into `@cairn/runtime`.

- [ ] **Step 6: Run test + typecheck**

Run: `pnpm vitest run packages/runtime/test/instance.test.ts`
Expected: PASS (1 test).

Run: `pnpm typecheck`
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat(runtime): scaffold @cairn/runtime with Instance model and paint walk"
```

---

## Task 2: scheduler + reactive bind

**Files:**
- Create: `packages/runtime/src/scheduler.ts`, `packages/runtime/src/reactive-props.ts`
- Modify: `packages/runtime/src/index.ts`
- Test: `packages/runtime/test/reactive-props.test.ts`

- [ ] **Step 1: Write the failing test**

`packages/runtime/test/reactive-props.test.ts`:
```ts
import { test, expect, vi } from 'vitest';
import { createRoot, createSignal } from '@cairn/reactivity';
import { bind, setFrameRequester } from '../src/index';

test('bind applies a static value once', () => {
  const apply = vi.fn();
  createRoot(() => {
    bind(42, apply);
  });
  expect(apply).toHaveBeenCalledTimes(1);
  expect(apply).toHaveBeenCalledWith(42);
});

test('bind re-applies a reactive value and schedules a frame on change', () => {
  const req = vi.fn();
  setFrameRequester(req);
  const [n, setN] = createSignal(1);
  const apply = vi.fn();
  const dispose = createRoot((d) => {
    bind(() => n(), apply);
    return d;
  });
  expect(apply).toHaveBeenNthCalledWith(1, 1);
  expect(req).toHaveBeenCalledTimes(1); // initial effect run schedules
  setN(2);
  expect(apply).toHaveBeenNthCalledWith(2, 2);
  expect(req).toHaveBeenCalledTimes(2);
  dispose();
  setFrameRequester(null);
});

test('scheduleFrame is a no-op when no requester is installed', () => {
  setFrameRequester(null);
  const apply = vi.fn();
  // reactive bind with no requester: applies but does not throw
  const dispose = createRoot((d) => {
    bind(() => 7, apply);
    return d;
  });
  expect(apply).toHaveBeenCalledWith(7);
  dispose();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run packages/runtime/test/reactive-props.test.ts`
Expected: FAIL — `bind` / `setFrameRequester` not exported.

- [ ] **Step 3: Implement scheduler + bind**

`packages/runtime/src/scheduler.ts`:
```ts
// Module-scoped frame requester. Phase 4 supports a single active root; mount installs
// a coalescing requester over the Host scheduler. scheduleFrame() forwards to it.
let requester: (() => void) | null = null;

export function setFrameRequester(fn: (() => void) | null): void {
  requester = fn;
}

export function scheduleFrame(): void {
  if (requester) requester();
}
```

`packages/runtime/src/reactive-props.ts`:
```ts
import { createEffect } from '@cairn/reactivity';
import { scheduleFrame } from './scheduler';

export type MaybeReactive<T> = T | (() => T);

// Apply a value to a sink. If the value is a function it is treated as reactive:
// it re-applies on dependency change and schedules a frame.
export function bind<T>(value: MaybeReactive<T>, apply: (v: T) => void): void {
  if (typeof value === 'function') {
    createEffect(() => {
      apply((value as () => T)());
      scheduleFrame();
    });
  } else {
    apply(value);
  }
}
```

`packages/runtime/src/index.ts` (replace with):
```ts
export type { Instance } from './instance';
export { paint } from './instance';
export { setFrameRequester, scheduleFrame } from './scheduler';
export { bind } from './reactive-props';
export type { MaybeReactive } from './reactive-props';
```

- [ ] **Step 4: Run test + typecheck**

Run: `pnpm vitest run packages/runtime/test/reactive-props.test.ts`
Expected: PASS (3 tests).

Run: `pnpm typecheck`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(runtime): frame scheduler hook + reactive bind"
```

---

## Task 3: jsx-runtime

**Files:**
- Create: `packages/runtime/src/jsx-runtime.ts`
- Modify: `packages/runtime/src/index.ts`
- Test: `packages/runtime/test/jsx-runtime.test.ts`

- [ ] **Step 1: Write the failing test**

`packages/runtime/test/jsx-runtime.test.ts`:
```ts
import { test, expect } from 'vitest';
import { jsx, jsxs, Fragment } from '../src/jsx-runtime';

test('jsx calls the component with its props', () => {
  const Comp = (props: { a: number }) => ({ tag: 'x', a: props.a });
  expect(jsx(Comp, { a: 5 })).toEqual({ tag: 'x', a: 5 });
});

test('jsxs is jsx (multiple children path)', () => {
  expect(jsxs).toBe(jsx);
});

test('Fragment returns its children', () => {
  const kids = [1, 2, 3];
  expect(Fragment({ children: kids })).toBe(kids);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run packages/runtime/test/jsx-runtime.test.ts`
Expected: FAIL — cannot resolve `../src/jsx-runtime`.

- [ ] **Step 3: Implement jsx-runtime**

`packages/runtime/src/jsx-runtime.ts`:
```ts
// Automatic JSX runtime. Every element is a function (primitive or user component),
// so jsx simply calls it with props. There are no lowercase host tags.
export function jsx(type: (props: any) => any, props: any): any {
  return type(props);
}

export const jsxs = jsx;

export function Fragment(props: { children?: any }): any {
  return props.children;
}
```

`packages/runtime/src/index.ts` (append):
```ts
export { jsx, jsxs, Fragment } from './jsx-runtime';
```

- [ ] **Step 4: Run test + typecheck**

Run: `pnpm vitest run packages/runtime/test/jsx-runtime.test.ts`
Expected: PASS (3 tests).

Run: `pnpm typecheck`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(runtime): automatic jsx-runtime (jsx/jsxs/Fragment)"
```

---

## Task 4: mount

**Files:**
- Create: `packages/runtime/src/mount.ts`
- Modify: `packages/runtime/src/index.ts`
- Test: `packages/runtime/test/mount.test.ts`

- [ ] **Step 1: Write the failing test**

`packages/runtime/test/mount.test.ts`:
```ts
import { test, expect } from 'vitest';
import { BoxNode } from '@cairn/layout';
import { mount, scheduleFrame, type Instance } from '../src/index';
import { createFakeHost } from './fake-host';

function makeInstance(): Instance {
  const layout = new BoxNode({ width: 50, height: 30 });
  return {
    layout,
    children: [],
    paintSelf(r) {
      r.fillRect({ x: 0, y: 0, width: layout.size.w, height: layout.size.h }, { color: '#f00' });
    },
  };
}
const beginFrames = (r: { calls: unknown[][] }) => r.calls.filter((c) => c[0] === 'beginFrame').length;

test('mount lays out and paints initially', () => {
  const { host, renderer } = createFakeHost();
  mount(makeInstance, host);
  const names = renderer.calls.map((c) => c[0]);
  expect(names).toContain('beginFrame');
  expect(names).toContain('clear');
  expect(names).toContain('fillRect');
  expect(names).toContain('endFrame');
});

test('changes coalesce into a single frame', () => {
  const { host, renderer, scheduler } = createFakeHost();
  mount(makeInstance, host);
  const before = beginFrames(renderer);
  scheduleFrame();
  scheduleFrame();
  expect(scheduler.pending.length).toBe(1); // coalesced
  scheduler.flush();
  expect(beginFrames(renderer)).toBe(before + 1);
});

test('re-renders on surface resize', () => {
  const { host, renderer, metrics } = createFakeHost();
  mount(makeInstance, host);
  const before = beginFrames(renderer);
  metrics.resize(400, 300);
  expect(beginFrames(renderer)).toBe(before + 1);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run packages/runtime/test/mount.test.ts`
Expected: FAIL — `mount` not exported.

- [ ] **Step 3: Implement mount**

`packages/runtime/src/mount.ts`:
```ts
import { createRoot } from '@cairn/reactivity';
import type { Host } from '@cairn/host';
import type { LayoutContext } from '@cairn/layout';
import { type Instance, paint } from './instance';
import { setFrameRequester } from './scheduler';

// Mount a component tree into a Host. Full-frame model: any change schedules one
// coalesced frame that re-lays-out from the root and repaints the whole surface.
export function mount(component: () => Instance, host: Host): () => void {
  return createRoot((dispose) => {
    const ctx: LayoutContext = {
      measureText: (t, s) => host.renderer.measureText(t, s),
    };
    let root: Instance;

    const renderFrame = (): void => {
      const w = host.metrics.width;
      const h = host.metrics.height;
      root.layout.layout({ minW: w, maxW: w, minH: h, maxH: h }, ctx); // tight = surface
      host.renderer.beginFrame();
      host.renderer.clear();
      paint(root, host.renderer);
      host.renderer.endFrame();
    };

    // Build the tree first. Effects run now; scheduleFrame() no-ops because the
    // requester is not installed yet (avoids a redundant initial frame).
    root = component();
    renderFrame(); // initial paint

    let frameScheduled = false;
    setFrameRequester(() => {
      if (frameScheduled) return;
      frameScheduled = true;
      host.scheduler.requestFrame(() => {
        frameScheduled = false;
        renderFrame();
      });
    });

    host.metrics.onResize(() => renderFrame());

    return () => {
      setFrameRequester(null);
      dispose();
    };
  });
}
```

`packages/runtime/src/index.ts` (append):
```ts
export { mount } from './mount';
```

- [ ] **Step 4: Run test + typecheck**

Run: `pnpm vitest run packages/runtime/test/mount.test.ts`
Expected: PASS (3 tests).

Run: `pnpm vitest run packages/runtime`
Expected: PASS (instance 1 + reactive-props 3 + jsx 3 + mount 3 = 10).

Run: `pnpm typecheck`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(runtime): mount with coalescing full-frame scheduler + resize"
```

---

## Task 5: @cairn/primitives scaffold + Box

**Files:**
- Create: `packages/primitives/package.json`, `packages/primitives/tsconfig.json`
- Create: `packages/primitives/src/box.ts`, `packages/primitives/src/index.ts`
- Create: `packages/primitives/test/fake.ts`
- Modify: `package.json` (root typecheck)
- Test: `packages/primitives/test/box.test.ts`

- [ ] **Step 1: Create the primitives test fake**

`packages/primitives/test/fake.ts`:
```ts
import type { Renderer } from '@cairn/host';
import type { LayoutContext } from '@cairn/layout';

export function createFakeRenderer(): Renderer & { calls: unknown[][] } {
  const calls: unknown[][] = [];
  const rec = (name: string) => (...args: unknown[]) => {
    calls.push([name, ...args]);
  };
  const r = {
    calls,
    resize: rec('resize'),
    beginFrame: rec('beginFrame'),
    endFrame: rec('endFrame'),
    clear: rec('clear'),
    save: rec('save'),
    restore: rec('restore'),
    translate: rec('translate'),
    scale: rec('scale'),
    clipRect: rec('clipRect'),
    setShadow: rec('setShadow'),
    fillRect: rec('fillRect'),
    strokeRect: rec('strokeRect'),
    fillRoundRect: rec('fillRoundRect'),
    strokeRoundRect: rec('strokeRoundRect'),
    fillPath: rec('fillPath'),
    strokePath: rec('strokePath'),
    drawText: rec('drawText'),
    measureText: (text: string) => {
      calls.push(['measureText', text]);
      return { width: text.length * 7 };
    },
    drawImage: rec('drawImage'),
  };
  return r as unknown as Renderer & { calls: unknown[][] };
}

export const fakeCtx: LayoutContext = {
  measureText: (text) => ({ width: text.length * 7 }),
};

const LOOSE = { minW: 0, maxW: 1000, minH: 0, maxH: 1000 };
export { LOOSE };
```

- [ ] **Step 2: Write the failing test**

`packages/primitives/test/box.test.ts`:
```ts
import { test, expect } from 'vitest';
import { BoxNode } from '@cairn/layout';
import { Box } from '../src/index';
import { createFakeRenderer, fakeCtx, LOOSE } from './fake';

test('Box builds a BoxNode with explicit size and paints its background', () => {
  const box = Box({ style: { width: 100, height: 40, backgroundColor: '#abc', borderRadius: 8 } });
  box.layout.layout(LOOSE, fakeCtx);
  expect(box.layout.size).toEqual({ w: 100, h: 40 });

  const r = createFakeRenderer();
  box.paintSelf(r);
  expect(r.calls).toContainEqual([
    'fillRoundRect',
    { x: 0, y: 0, width: 100, height: 40 },
    8,
    { color: '#abc' },
  ]);
});

test('Box with no background paints nothing', () => {
  const box = Box({ style: { width: 10, height: 10 } });
  box.layout.layout(LOOSE, fakeCtx);
  const r = createFakeRenderer();
  box.paintSelf(r);
  expect(r.calls).toEqual([]);
});

test('Box links a single child into layout and instance trees', () => {
  const child = Box({ style: { width: 10, height: 10 } });
  const box = Box({ style: { padding: 5 }, children: child });
  expect(box.children).toEqual([child]);
  expect((box.layout as BoxNode).children[0]).toBe(child.layout);
  box.layout.layout(LOOSE, fakeCtx);
  expect(child.layout.offsetX).toBe(5);
  expect(child.layout.offsetY).toBe(5);
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `pnpm vitest run packages/primitives/test/box.test.ts`
Expected: FAIL — cannot resolve `../src/index`.

- [ ] **Step 4: Create the package + Box**

`packages/primitives/package.json`:
```json
{
  "name": "@cairn/primitives",
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
    "@cairn/runtime": "workspace:*",
    "@cairn/layout": "workspace:*",
    "@cairn/host": "workspace:*"
  }
}
```

`packages/primitives/tsconfig.json`:
```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist"
  },
  "include": ["src", "test"]
}
```

`packages/primitives/src/box.ts`:
```ts
import type { Renderer } from '@cairn/host';
import { BoxNode, type EdgeInsets } from '@cairn/layout';
import type { Instance } from '@cairn/runtime';

export interface BoxStyle {
  width?: number;
  height?: number;
  padding?: number | Partial<EdgeInsets>;
  backgroundColor?: string;
  borderRadius?: number;
}

export interface BoxProps {
  style?: BoxStyle;
  children?: Instance;
}

export function Box(props: BoxProps = {}): Instance {
  const style = props.style ?? {};
  const child = props.children;
  const layout = new BoxNode({
    width: style.width,
    height: style.height,
    padding: style.padding,
    child: child?.layout,
  });
  return {
    layout,
    children: child ? [child] : [],
    paintSelf(r: Renderer) {
      if (style.backgroundColor) {
        r.fillRoundRect(
          { x: 0, y: 0, width: layout.size.w, height: layout.size.h },
          style.borderRadius ?? 0,
          { color: style.backgroundColor },
        );
      }
    },
  };
}
```

`packages/primitives/src/index.ts`:
```ts
export { Box } from './box';
export type { BoxProps, BoxStyle } from './box';
```

- [ ] **Step 5: Update root typecheck + install**

Modify root `package.json` `scripts.typecheck` to append the primitives project (after runtime):
```json
    "typecheck": "tsc --noEmit -p packages/reactivity/tsconfig.json && tsc --noEmit -p packages/host/tsconfig.json && tsc --noEmit -p packages/platform-web/tsconfig.json && tsc --noEmit -p packages/layout/tsconfig.json && tsc --noEmit -p packages/runtime/tsconfig.json && tsc --noEmit -p packages/primitives/tsconfig.json"
```

Run: `pnpm install`
Expected: no errors; `@cairn/runtime` symlinked into `@cairn/primitives`.

- [ ] **Step 6: Run test + typecheck**

Run: `pnpm vitest run packages/primitives/test/box.test.ts`
Expected: PASS (3 tests).

Run: `pnpm typecheck`
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat(primitives): scaffold @cairn/primitives + Box"
```

---

## Task 6: Text primitive (static + reactive content)

**Files:**
- Create: `packages/primitives/src/text.ts`
- Modify: `packages/primitives/src/index.ts`
- Test: `packages/primitives/test/text.test.ts`

- [ ] **Step 1: Write the failing test**

`packages/primitives/test/text.test.ts`:
```ts
import { test, expect } from 'vitest';
import { TextNode } from '@cairn/layout';
import { createRoot, createSignal } from '@cairn/reactivity';
import { setFrameRequester } from '@cairn/runtime';
import { Text } from '../src/index';
import { createFakeRenderer, fakeCtx, LOOSE } from './fake';

test('Text renders static content and paints drawText with style', () => {
  const t = Text({ children: 'hi', style: { font: '20px sans-serif', color: '#111' } });
  t.layout.layout(LOOSE, fakeCtx);
  expect((t.layout as TextNode).text).toBe('hi');

  const r = createFakeRenderer();
  t.paintSelf(r);
  expect(r.calls).toContainEqual([
    'drawText',
    'hi',
    { x: 0, y: 0 },
    { font: '20px sans-serif', color: '#111', baseline: 'top' },
  ]);
});

test('Text coerces numbers to strings', () => {
  const t = Text({ children: 7 });
  t.layout.layout(LOOSE, fakeCtx);
  expect((t.layout as TextNode).text).toBe('7');
});

test('Text reactive content updates on signal change', () => {
  setFrameRequester(() => {});
  const [n, setN] = createSignal(1);
  let t!: ReturnType<typeof Text>;
  const dispose = createRoot((d) => {
    t = Text({ children: () => String(n()) });
    return d;
  });
  expect((t.layout as TextNode).text).toBe('1');
  setN(2);
  expect((t.layout as TextNode).text).toBe('2');
  dispose();
  setFrameRequester(null);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run packages/primitives/test/text.test.ts`
Expected: FAIL — `Text` not exported.

- [ ] **Step 3: Implement text.ts and export it**

`packages/primitives/src/text.ts`:
```ts
import type { Renderer } from '@cairn/host';
import { TextNode } from '@cairn/layout';
import { type Instance, bind, type MaybeReactive } from '@cairn/runtime';

export interface TextStyle {
  font?: string;
  color?: string;
}

export interface TextProps {
  children?: MaybeReactive<string | number>;
  value?: MaybeReactive<string | number>;
  style?: TextStyle;
}

export function Text(props: TextProps = {}): Instance {
  const style = props.style ?? {};
  const font = style.font ?? '16px sans-serif';
  const color = style.color ?? '#000';
  const layout = new TextNode({ text: '', style: { font } });
  const content = props.value ?? props.children ?? '';
  bind(content, (v) => {
    layout.text = String(v);
  });
  return {
    layout,
    children: [],
    paintSelf(r: Renderer) {
      r.drawText(layout.text, { x: 0, y: 0 }, { font, color, baseline: 'top' });
    },
  };
}
```

`packages/primitives/src/index.ts` (append):
```ts
export { Text } from './text';
export type { TextProps, TextStyle } from './text';
```

- [ ] **Step 4: Run test + typecheck**

Run: `pnpm vitest run packages/primitives/test/text.test.ts`
Expected: PASS (3 tests).

Run: `pnpm typecheck`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(primitives): Text (static + reactive content)"
```

---

## Task 7: Row / Column primitives

**Files:**
- Create: `packages/primitives/src/flex.ts`
- Modify: `packages/primitives/src/index.ts`
- Test: `packages/primitives/test/flex.test.ts`

- [ ] **Step 1: Write the failing test**

`packages/primitives/test/flex.test.ts`:
```ts
import { test, expect } from 'vitest';
import { FlexNode } from '@cairn/layout';
import { Box, Row, Column } from '../src/index';
import { fakeCtx } from './fake';

test('Row builds a row FlexNode and positions children left to right', () => {
  const a = Box({ style: { width: 10, height: 10 } });
  const b = Box({ style: { width: 20, height: 10 } });
  const row = Row({ style: { gap: 5 }, children: [a, b] });
  expect((row.layout as FlexNode).direction).toBe('row');
  expect(row.children).toEqual([a, b]);

  row.layout.layout({ minW: 0, maxW: 100, minH: 0, maxH: 100 }, fakeCtx);
  expect(a.layout.offsetX).toBe(0);
  expect(b.layout.offsetX).toBe(15); // 10 + gap 5
});

test('Column builds a column FlexNode stacking top to bottom', () => {
  const a = Box({ style: { width: 10, height: 20 } });
  const b = Box({ style: { width: 10, height: 30 } });
  const col = Column({ style: { gap: 4 }, children: [a, b] });
  expect((col.layout as FlexNode).direction).toBe('column');
  col.layout.layout({ minW: 0, maxW: 100, minH: 0, maxH: 100 }, fakeCtx);
  expect(a.layout.offsetY).toBe(0);
  expect(b.layout.offsetY).toBe(24); // 20 + gap 4
});

test('Row accepts a single (non-array) child', () => {
  const only = Box({ style: { width: 10, height: 10 } });
  const row = Row({ children: only });
  expect(row.children).toEqual([only]);
  expect((row.layout as FlexNode).children[0]).toBe(only.layout);
});

test('Row containers paint nothing themselves', () => {
  const row = Row({ children: [] });
  const calls: unknown[][] = [];
  row.paintSelf({ fillRect: () => calls.push(['fillRect']) } as never);
  expect(calls).toEqual([]);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run packages/primitives/test/flex.test.ts`
Expected: FAIL — `Row`/`Column` not exported.

- [ ] **Step 3: Implement flex.ts and export it**

`packages/primitives/src/flex.ts`:
```ts
import { FlexNode, type FlexDirection, type Justify, type Align } from '@cairn/layout';
import type { Instance } from '@cairn/runtime';

export interface FlexStyle {
  gap?: number;
  justify?: Justify;
  align?: Align;
}

export interface FlexProps {
  style?: FlexStyle;
  children?: Instance | Instance[];
}

function flex(direction: FlexDirection, props: FlexProps): Instance {
  const style = props.style ?? {};
  const children =
    props.children == null ? [] : Array.isArray(props.children) ? props.children : [props.children];
  const layout = new FlexNode({
    direction,
    gap: style.gap,
    justify: style.justify,
    align: style.align,
    children: children.map((c) => c.layout),
  });
  return {
    layout,
    children,
    paintSelf() {
      // containers have no own visuals
    },
  };
}

export function Row(props: FlexProps = {}): Instance {
  return flex('row', props);
}

export function Column(props: FlexProps = {}): Instance {
  return flex('column', props);
}
```

`packages/primitives/src/index.ts` (append):
```ts
export { Row, Column } from './flex';
export type { FlexProps, FlexStyle } from './flex';
```

- [ ] **Step 4: Run test + typecheck**

Run: `pnpm vitest run packages/primitives/test/flex.test.ts`
Expected: PASS (4 tests).

Run: `pnpm typecheck`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(primitives): Row and Column (FlexNode wrappers)"
```

---

## Task 8: Counter integration test, example, READMEs, full green

**Files:**
- Create: `packages/primitives/test/counter.test.ts`
- Create: `packages/primitives/test/fake-host.ts`
- Create: `examples/counter/index.html`, `examples/counter/main.tsx`, `examples/counter/vite.config.ts`
- Create: `packages/runtime/README.md`, `packages/primitives/README.md`

- [ ] **Step 1: Add a fake host for the primitives package**

`packages/primitives/test/fake-host.ts`:
```ts
import type { Renderer, FrameScheduler, SurfaceMetrics, Host } from '@cairn/host';
import { createFakeRenderer } from './fake';

export function createFakeHost() {
  const renderer = createFakeRenderer();
  const pending: Array<() => void> = [];
  const scheduler: FrameScheduler = {
    requestFrame(cb) {
      pending.push(() => cb(0));
      return pending.length;
    },
    cancelFrame() {},
  };
  const metrics: SurfaceMetrics = {
    width: 200,
    height: 100,
    devicePixelRatio: 1,
    onResize: () => () => {},
    dispose: () => {},
  };
  const host: Host = { renderer, scheduler, metrics };
  return {
    host,
    renderer,
    flush() {
      const q = pending.splice(0);
      for (const f of q) f();
    },
  };
}
```

- [ ] **Step 2: Write the failing integration test**

`packages/primitives/test/counter.test.ts`:
```ts
import { test, expect } from 'vitest';
import { createSignal } from '@cairn/reactivity';
import { mount } from '@cairn/runtime';
import { Box, Column, Text } from '../src/index';
import { createFakeHost } from './fake-host';

const drawnTexts = (r: { calls: unknown[][] }) =>
  r.calls.filter((c) => c[0] === 'drawText').map((c) => c[1]);

test('reactive counter repaints with the new value after a signal change', () => {
  const { host, renderer, flush } = createFakeHost();
  const [count, setCount] = createSignal(0);

  const App = () =>
    Column({
      style: { justify: 'center', align: 'center' },
      children: Box({
        style: { backgroundColor: '#3b82f6', borderRadius: 12, padding: 16 },
        children: Text({ style: { font: '48px sans-serif', color: '#fff' }, children: () => String(count()) }),
      }),
    });

  mount(App, host);

  // initial frame drew "0"
  expect(drawnTexts(renderer)).toContain('0');

  // change the signal, flush the coalesced frame
  setCount(1);
  flush();
  expect(drawnTexts(renderer)).toContain('1');
});
```

- [ ] **Step 3: Run test to verify it fails, then confirm it passes**

Run: `pnpm vitest run packages/primitives/test/counter.test.ts`
Expected: PASS — the runtime + primitives are already implemented; this test verifies end-to-end reactive repaint. (If it fails, the bug is in the mount/bind/scheduler wiring — fix there, do not weaken the test.)

- [ ] **Step 4: Create the browser example**

`examples/counter/index.html`:
```html
<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Cairn — counter</title>
    <style>
      html, body { margin: 0; height: 100%; }
      #stage { display: block; width: 100vw; height: 100vh; cursor: pointer; }
    </style>
  </head>
  <body>
    <canvas id="stage"></canvas>
    <script type="module" src="./main.tsx"></script>
  </body>
</html>
```

`examples/counter/main.tsx`:
```tsx
import { createSignal } from '@cairn/reactivity';
import { createWebHost } from '@cairn/platform-web';
import { mount } from '@cairn/runtime';
import { Box, Column, Text } from '@cairn/primitives';

const canvas = document.getElementById('stage') as HTMLCanvasElement;
const host = createWebHost(canvas);

const [count, setCount] = createSignal(0);

function App() {
  return (
    <Column style={{ justify: 'center', align: 'center', gap: 12 }}>
      <Box style={{ backgroundColor: '#3b82f6', borderRadius: 16, padding: 24 }}>
        <Column style={{ gap: 8, align: 'center' }}>
          <Text style={{ font: 'bold 20px sans-serif', color: '#e0e7ff' }}>Cairn counter</Text>
          <Text style={{ font: '64px sans-serif', color: '#ffffff' }}>{() => String(count())}</Text>
        </Column>
      </Box>
    </Column>
  );
}

mount(App, host);

// Temporary interaction until the events phase (Phase 7): click to increment.
canvas.addEventListener('click', () => setCount(count() + 1));
```

`examples/counter/vite.config.ts`:
```ts
import { defineConfig } from 'vite';

export default defineConfig({
  esbuild: {
    jsx: 'automatic',
    jsxImportSource: '@cairn/runtime',
  },
});
```

- [ ] **Step 5: Write the READMEs**

`packages/runtime/README.md`:
```markdown
# @cairn/runtime

The runtime that turns JSX + signals into a live canvas app. SolidJS-style: components run
once and return an `Instance` (has-a layout node + `paintSelf` + children); reactivity updates
instances in place.

## Exports

- `mount(component, host)` — build the tree, do an initial layout+paint, and drive a
  coalesced full-frame re-render on every reactive change and on surface resize.
- `paint(instance, renderer)` — the paint walk (translate by relative offsets, draw, recurse).
- `bind(value, apply)` — apply a value to a sink; if it is a function it is reactive.
- `jsx`/`jsxs`/`Fragment` (also at `@cairn/runtime/jsx-runtime`) — automatic JSX runtime.
- `setFrameRequester` / `scheduleFrame` — the module frame-scheduling hook.

## JSX setup

Configure your bundler with `jsx: 'automatic'`, `jsxImportSource: '@cairn/runtime'`. Dynamic
values are passed as functions/accessors (runtime-reactive convention); a compile-time plugin
for `{count()}` sugar is a separate future lib.

## Notes

Phase 4 uses a full-frame model (any change re-lays-out + repaints the whole surface) and a
single active root. Dirty-region rendering and multi-root come later.
```

`packages/primitives/README.md`:
```markdown
# @cairn/primitives

Core Cairn UI primitives, built on `@cairn/runtime` and `@cairn/layout`.

- `Box` — single-child container; `style`: `width`, `height`, `padding`, `backgroundColor`,
  `borderRadius`.
- `Text` — text content (string, number, or an accessor for reactivity); `style`: `font`, `color`.
- `Row` / `Column` — flex containers; `style`: `gap`, `justify`, `align`.

## Example

```tsx
import { Box, Column, Text } from '@cairn/primitives';

<Column style={{ align: 'center', gap: 8 }}>
  <Box style={{ backgroundColor: '#3b82f6', borderRadius: 16, padding: 24 }}>
    <Text style={{ font: '48px sans-serif', color: '#fff' }}>{() => String(count())}</Text>
  </Box>
</Column>
```

Styling is minimal inline for now; a full `StyleSheet` + theme lands in a later phase.
```

- [ ] **Step 6: Run the full workspace suite + typecheck**

Run: `pnpm vitest run`
Expected: PASS — all packages green (reactivity + host + platform-web + layout + runtime + primitives).

Run: `pnpm typecheck`
Expected: no errors across all six packages.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat(primitives): reactive counter integration test + example + READMEs; finalize Phase 4 (M3)"
```

---

## Self-Review Notes (for the implementer)

- **Spec coverage:** Instance + paint walk → Task 1. scheduler + reactive `bind` → Task 2. jsx-runtime → Task 3. `mount` (coalescing full-frame, resize) → Task 4. Box → Task 5. Text (static + reactive) → Task 6. Row/Column → Task 7. Counter integration + example + READMEs → Task 8.
- **mount ordering refinement:** the tree is built and the initial `renderFrame()` runs BEFORE the frame requester is installed, so the binding effects' initial `scheduleFrame()` no-ops (no redundant initial frame). This refines the spec's snippet; behavior matches the spec's intent (single coalesced frame per change).
- **Deferred (per spec):** compile-time JSX plugin, events/onClick (temporary raw canvas listener in the example only), control flow, full StyleSheet, dirty-region, multi-root.
- **Type consistency:** `Instance = { layout: LayoutNode; paintSelf(r: Renderer): void; children: Instance[] }` used identically across runtime and primitives. `bind(value, apply)` and `MaybeReactive<T>` match between reactive-props and Text. Primitives read `.layout` off child instances to link layout trees; `paint` uses `layout.offsetX/offsetY` and `layout.size`. Fake renderers in both packages record `['method', ...args]`.
- **Determinism:** fake `measureText` returns `text.length * 7`; the counter test asserts on `drawText` content ('0' then '1'), independent of measured widths.
```
