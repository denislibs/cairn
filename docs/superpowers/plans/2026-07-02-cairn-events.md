# Cairn Phase 7a — Events (pointer + hit-testing + onClick) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Cairn interactive with pointer input — an `InputSource` platform seam, a DOM-free `@cairn/events` package (hit-testing + bubble dispatch + click synthesis), runtime wiring, primitive event props, and a browser `WebInputSource` — so `<Box onClick={...}>` responds to real clicks.

**Architecture:** Raw pointer/wheel input enters through an `InputSource` on the `Host`. Runtime `mount` creates a `createPointerDispatcher(() => root)` and subscribes it to `host.input`. On each pointer event the dispatcher hit-tests the instance tree (which structurally satisfies `HitNode`), builds a bubble path `[target … root]`, and dispatches to matching handlers; `pointerup` synthesizes a `click` at the nearest common ancestor of the down/up paths. Primitives expose `onClick`/`onPointer*`/`onWheel` props that populate `Instance.handlers`.

**Tech Stack:** TypeScript (strict), pnpm workspaces, Vitest. Core packages compile with `lib: ["ES2022"]` (DOM-free); only `@cairn/platform-web` has the DOM lib.

**Spec:** `docs/superpowers/specs/2026-07-02-cairn-events-design.md`

---

## File Structure

**New package `@cairn/events`** (DOM-free):
- `packages/events/package.json` — deps: `@cairn/host`
- `packages/events/tsconfig.json` — extends base (no DOM lib)
- `packages/events/src/event.ts` — `HitNode`, `CairnPointerEvent`, `CairnWheelEvent`, `EventHandlers`
- `packages/events/src/hit-test.ts` — `hitTest(root, x, y): HitNode[]`
- `packages/events/src/dispatch.ts` — `dispatch`, `dispatchWheel`
- `packages/events/src/pointer-dispatcher.ts` — `nearestCommonAncestor`, `createPointerDispatcher`
- `packages/events/src/index.ts` — public exports
- `packages/events/test/*.test.ts` — unit tests

**`@cairn/host`:**
- Create `packages/host/src/input.ts` — `PointerInput`, `WheelInput`, `InputSource`
- Modify `packages/host/src/host.ts` — add `input: InputSource`
- Modify `packages/host/src/index.ts` — export input types

**`@cairn/runtime`:**
- Modify `packages/runtime/src/instance.ts` — add `handlers?: EventHandlers`
- Modify `packages/runtime/src/mount.ts` — subscribe pointer dispatcher
- Modify `packages/runtime/package.json` — add `@cairn/events` dep
- Modify `packages/runtime/test/fake-host.ts` — add fake `InputSource`

**`@cairn/primitives`:**
- Create `packages/primitives/src/events.ts` — `EventProps`, `collectHandlers`
- Modify `packages/primitives/src/{box,text,flex}.ts` — accept event props
- Modify `packages/primitives/src/index.ts` — export `EventProps`
- Modify `packages/primitives/package.json` — add `@cairn/events` dep

**`@cairn/platform-web`:**
- Create `packages/platform-web/src/web-input-source.ts` — `WebInputSource`
- Modify `packages/platform-web/src/create-web-host.ts` — real `input`
- Modify `packages/platform-web/src/index.ts` — export `WebInputSource`

**Root:**
- Modify `package.json` — add events package to `typecheck` script
- Modify `examples/counter/main.tsx` — real `<Box onClick>`

---

## Task 1: `@cairn/host` — InputSource seam + `Host.input`

**Files:**
- Create: `packages/host/src/input.ts`
- Modify: `packages/host/src/host.ts`
- Modify: `packages/host/src/index.ts`
- Modify: `packages/runtime/test/fake-host.ts` (keep workspace typecheck green)
- Modify: `packages/platform-web/src/create-web-host.ts` (temporary stub, replaced in Task 8)
- Test: `packages/host/test/input.test.ts`

`Host.input` is **required**. Because two implementers (`createWebHost`, the runtime fake host) construct a `Host`, this task also fixes both so the whole-workspace `pnpm typecheck` stays green. The `createWebHost` change is a throwaway no-op replaced by `WebInputSource` in Task 8.

- [ ] **Step 1: Write the failing test**

Create `packages/host/test/input.test.ts`:

```ts
import { test, expect } from 'vitest';
import type { InputSource, PointerInput, WheelInput } from '../src/index';

// InputSource is a pure interface; this proves it is implementable and that
// subscribe returns an unsubscribe that stops delivery.
function makeStub(): InputSource {
  const pointer = new Set<(e: PointerInput) => void>();
  const wheel = new Set<(e: WheelInput) => void>();
  return {
    onPointer(cb) {
      pointer.add(cb);
      return () => pointer.delete(cb);
    },
    onWheel(cb) {
      wheel.add(cb);
      return () => wheel.delete(cb);
    },
    // expose emit for the test via casting below
  } as InputSource;
}

test('InputSource is implementable with unsubscribe semantics', () => {
  const src = makeStub();
  const received: PointerInput[] = [];
  const off = src.onPointer((e) => received.push(e));
  expect(typeof off).toBe('function');
  off();
  expect(received).toEqual([]);
});

test('PointerInput / WheelInput shapes are usable', () => {
  const p: PointerInput = { type: 'pointerdown', x: 1, y: 2, button: 0, pointerType: 'mouse' };
  const w: WheelInput = { x: 1, y: 2, deltaX: 0, deltaY: 4 };
  expect(p.type).toBe('pointerdown');
  expect(w.deltaY).toBe(4);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run packages/host/test/input.test.ts`
Expected: FAIL — cannot resolve `InputSource`/`PointerInput`/`WheelInput` from `../src/index`.

- [ ] **Step 3: Create `packages/host/src/input.ts`**

```ts
export type PointerInputType = 'pointerdown' | 'pointermove' | 'pointerup';

export interface PointerInput {
  type: PointerInputType;
  x: number; // logical px, relative to the surface top-left
  y: number;
  button: number; // 0 = primary
  pointerType: 'mouse' | 'touch' | 'pen';
}

export interface WheelInput {
  x: number;
  y: number;
  deltaX: number;
  deltaY: number;
}

export interface InputSource {
  onPointer(cb: (e: PointerInput) => void): () => void; // returns unsubscribe
  onWheel(cb: (e: WheelInput) => void): () => void; // returns unsubscribe
}
```

- [ ] **Step 4: Add `input` to `Host`**

In `packages/host/src/host.ts`, replace the file body with:

```ts
import type { Renderer } from './renderer';
import type { FrameScheduler } from './scheduler';
import type { SurfaceMetrics } from './metrics';
import type { InputSource } from './input';

// textInput / a11y are added in their own phases (8 / 14).
export interface Host {
  renderer: Renderer;
  scheduler: FrameScheduler;
  metrics: SurfaceMetrics;
  input: InputSource;
}
```

- [ ] **Step 5: Export the input types**

In `packages/host/src/index.ts`, add after the `Host` export line:

```ts
export type { InputSource, PointerInput, WheelInput, PointerInputType } from './input';
```

- [ ] **Step 6: Keep runtime fake host green — add a fake InputSource**

In `packages/runtime/test/fake-host.ts`, add these imports to the existing import line's type list (`Renderer, FrameScheduler, SurfaceMetrics, Host` → also `InputSource, PointerInput, WheelInput`):

```ts
import type {
  Renderer,
  FrameScheduler,
  SurfaceMetrics,
  Host,
  InputSource,
  PointerInput,
  WheelInput,
} from '@cairn/host';
```

Add this factory (place it above `createFakeHost`):

```ts
export function createFakeInput() {
  const pointerCbs = new Set<(e: PointerInput) => void>();
  const wheelCbs = new Set<(e: WheelInput) => void>();
  const input: InputSource = {
    onPointer(cb) {
      pointerCbs.add(cb);
      return () => pointerCbs.delete(cb);
    },
    onWheel(cb) {
      wheelCbs.add(cb);
      return () => wheelCbs.delete(cb);
    },
  };
  return {
    input,
    emitPointer(e: PointerInput) {
      for (const cb of pointerCbs) cb(e);
    },
    emitWheel(e: WheelInput) {
      for (const cb of wheelCbs) cb(e);
    },
  };
}
```

Update `createFakeHost` to include input:

```ts
export function createFakeHost() {
  const renderer = createFakeRenderer();
  const scheduler = createFakeScheduler();
  const metrics = createFakeMetrics();
  const input = createFakeInput();
  const host: Host = {
    renderer,
    scheduler: scheduler.scheduler,
    metrics: metrics.metrics,
    input: input.input,
  };
  return { host, renderer, scheduler, metrics, input };
}
```

- [ ] **Step 7: Keep platform-web green — temporary no-op input**

In `packages/platform-web/src/create-web-host.ts`, change the return so `Host` is satisfied (replaced by `WebInputSource` in Task 8):

```ts
  // Placeholder input; replaced by WebInputSource in Task 8.
  const input = {
    onPointer: () => () => {},
    onWheel: () => () => {},
  };

  return { renderer, scheduler, metrics, input };
```

- [ ] **Step 8: Run tests + typecheck to verify green**

Run: `pnpm vitest run packages/host/test/input.test.ts`
Expected: PASS (2 tests).
Run: `pnpm typecheck`
Expected: PASS across the workspace.

- [ ] **Step 9: Commit**

```bash
git add packages/host/src/input.ts packages/host/src/host.ts packages/host/src/index.ts \
  packages/host/test/input.test.ts packages/runtime/test/fake-host.ts \
  packages/platform-web/src/create-web-host.ts
git commit -m "feat(host): InputSource seam + Host.input"
```

---

## Task 2: `@cairn/events` package scaffold + event model

**Files:**
- Create: `packages/events/package.json`
- Create: `packages/events/tsconfig.json`
- Create: `packages/events/src/event.ts`
- Create: `packages/events/src/index.ts`
- Modify: `package.json` (root typecheck script)
- Test: `packages/events/test/event.test.ts`

- [ ] **Step 1: Create the package manifest**

`packages/events/package.json`:

```json
{
  "name": "@cairn/events",
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

`packages/events/tsconfig.json` (no DOM lib — keeps events DOM-free):

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist"
  },
  "include": ["src", "test"]
}
```

- [ ] **Step 2: Write the failing test**

`packages/events/test/event.test.ts`:

```ts
import { test, expect } from 'vitest';
import type { HitNode, EventHandlers, CairnPointerEvent } from '../src/index';

function node(handlers?: EventHandlers, children: HitNode[] = []): HitNode {
  return { layout: { offsetX: 0, offsetY: 0, size: { w: 10, h: 10 } }, children, handlers };
}

test('HitNode carries structural layout + optional handlers', () => {
  const n = node();
  expect(n.layout.size.w).toBe(10);
  expect(n.children).toEqual([]);
  expect(n.handlers).toBeUndefined();
});

test('EventHandlers accepts pointer + wheel callbacks', () => {
  const seen: string[] = [];
  const handlers: EventHandlers = {
    onClick: (e: CairnPointerEvent) => seen.push(e.type),
  };
  const parent = node(handlers, [node()]);
  expect(parent.handlers?.onClick).toBeTypeOf('function');
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `pnpm vitest run packages/events/test/event.test.ts`
Expected: FAIL — cannot resolve `../src/index`.

- [ ] **Step 4: Create the event model**

`packages/events/src/event.ts`:

```ts
export interface HitNode {
  layout: { offsetX: number; offsetY: number; size: { w: number; h: number } };
  children: HitNode[];
  handlers?: EventHandlers;
}

export interface CairnPointerEvent {
  type: 'pointerdown' | 'pointermove' | 'pointerup' | 'click';
  x: number;
  y: number;
  button: number;
  pointerType: 'mouse' | 'touch' | 'pen';
  target: HitNode;
  stopPropagation(): void;
}

export interface CairnWheelEvent {
  x: number;
  y: number;
  deltaX: number;
  deltaY: number;
  target: HitNode;
  stopPropagation(): void;
}

export interface EventHandlers {
  onPointerDown?(e: CairnPointerEvent): void;
  onPointerMove?(e: CairnPointerEvent): void;
  onPointerUp?(e: CairnPointerEvent): void;
  onClick?(e: CairnPointerEvent): void;
  onWheel?(e: CairnWheelEvent): void;
}
```

- [ ] **Step 5: Create the barrel export**

`packages/events/src/index.ts`:

```ts
export type { HitNode, CairnPointerEvent, CairnWheelEvent, EventHandlers } from './event';
```

- [ ] **Step 6: Add events to the root typecheck script**

In `package.json`, append to the `typecheck` script (after the `style` entry):

```
 && tsc --noEmit -p packages/events/tsconfig.json
```

The full script becomes:

```json
    "typecheck": "tsc --noEmit -p packages/reactivity/tsconfig.json && tsc --noEmit -p packages/host/tsconfig.json && tsc --noEmit -p packages/platform-web/tsconfig.json && tsc --noEmit -p packages/layout/tsconfig.json && tsc --noEmit -p packages/runtime/tsconfig.json && tsc --noEmit -p packages/primitives/tsconfig.json && tsc --noEmit -p packages/style/tsconfig.json && tsc --noEmit -p packages/events/tsconfig.json"
```

- [ ] **Step 7: Install workspace links + verify**

Run: `pnpm install`
Expected: links `@cairn/events`.
Run: `pnpm vitest run packages/events/test/event.test.ts`
Expected: PASS (2 tests).
Run: `pnpm typecheck`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add packages/events/package.json packages/events/tsconfig.json \
  packages/events/src/event.ts packages/events/src/index.ts \
  packages/events/test/event.test.ts package.json pnpm-lock.yaml
git commit -m "feat(events): package scaffold + event model (HitNode, events, handlers)"
```

---

## Task 3: `hitTest`

**Files:**
- Create: `packages/events/src/hit-test.ts`
- Modify: `packages/events/src/index.ts`
- Test: `packages/events/test/hit-test.test.ts`

- [ ] **Step 1: Write the failing test**

`packages/events/test/hit-test.test.ts`:

```ts
import { test, expect } from 'vitest';
import { hitTest } from '../src/index';
import type { HitNode } from '../src/index';

// root(100x100) > [ A(0,0 50x100) > a1(0,0 50x50), B(50,0 50x100) > b1(0,0 50x50) ]
function tree() {
  const a1: HitNode = { layout: { offsetX: 0, offsetY: 0, size: { w: 50, h: 50 } }, children: [] };
  const b1: HitNode = { layout: { offsetX: 0, offsetY: 0, size: { w: 50, h: 50 } }, children: [] };
  const A: HitNode = { layout: { offsetX: 0, offsetY: 0, size: { w: 50, h: 100 } }, children: [a1] };
  const B: HitNode = { layout: { offsetX: 50, offsetY: 0, size: { w: 50, h: 100 } }, children: [b1] };
  const root: HitNode = { layout: { offsetX: 0, offsetY: 0, size: { w: 100, h: 100 } }, children: [A, B] };
  return { root, A, B, a1, b1 };
}

test('returns [target ... root] bubble path for a nested hit', () => {
  const { root, A, a1 } = tree();
  expect(hitTest(root, 10, 10)).toEqual([a1, A, root]);
});

test('descends into the correct sibling by absolute offset', () => {
  const { root, B, b1 } = tree();
  expect(hitTest(root, 60, 10)).toEqual([b1, B, root]);
});

test('topmost (later-painted) overlapping sibling wins', () => {
  // two full-size children stacked; the second is painted on top
  const under: HitNode = { layout: { offsetX: 0, offsetY: 0, size: { w: 100, h: 100 } }, children: [] };
  const over: HitNode = { layout: { offsetX: 0, offsetY: 0, size: { w: 100, h: 100 } }, children: [] };
  const root: HitNode = { layout: { offsetX: 0, offsetY: 0, size: { w: 100, h: 100 } }, children: [under, over] };
  expect(hitTest(root, 50, 50)).toEqual([over, root]);
});

test('a miss on the root returns []', () => {
  const { root } = tree();
  expect(hitTest(root, 999, 999)).toEqual([]);
});

test('a point inside root but outside all children returns [root]', () => {
  const child: HitNode = { layout: { offsetX: 0, offsetY: 0, size: { w: 10, h: 10 } }, children: [] };
  const root: HitNode = { layout: { offsetX: 0, offsetY: 0, size: { w: 100, h: 100 } }, children: [child] };
  expect(hitTest(root, 90, 90)).toEqual([root]);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run packages/events/test/hit-test.test.ts`
Expected: FAIL — `hitTest` is not exported.

- [ ] **Step 3: Implement `hitTest`**

`packages/events/src/hit-test.ts`:

```ts
import type { HitNode } from './event';

// Depth-first hit-test. Accumulates absolute offset from the root; descends only
// when the point is inside the node, checking children in reverse (later-painted
// on top). Returns the bubble path [target ... root], or [] if the root is missed.
// v1 limitation: descent is gated by the parent's box, so children overflowing
// their parent are not hit.
export function hitTest(root: HitNode, x: number, y: number): HitNode[] {
  return hitAt(root, x, y, 0, 0) ?? [];
}

function hitAt(node: HitNode, x: number, y: number, ax: number, ay: number): HitNode[] | null {
  const nx = ax + node.layout.offsetX;
  const ny = ay + node.layout.offsetY;
  const { w, h } = node.layout.size;
  if (x < nx || x >= nx + w || y < ny || y >= ny + h) return null;

  for (let i = node.children.length - 1; i >= 0; i--) {
    const child = node.children[i];
    const hit = hitAt(child, x, y, nx, ny);
    if (hit) return [...hit, node];
  }
  return [node];
}
```

- [ ] **Step 4: Export `hitTest`**

In `packages/events/src/index.ts`, add:

```ts
export { hitTest } from './hit-test';
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm vitest run packages/events/test/hit-test.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 6: Commit**

```bash
git add packages/events/src/hit-test.ts packages/events/src/index.ts \
  packages/events/test/hit-test.test.ts
git commit -m "feat(events): hitTest — bubble-order path with topmost-wins descent"
```

---

## Task 4: `dispatch` + `dispatchWheel`

**Files:**
- Create: `packages/events/src/dispatch.ts`
- Modify: `packages/events/src/index.ts`
- Test: `packages/events/test/dispatch.test.ts`

- [ ] **Step 1: Write the failing test**

`packages/events/test/dispatch.test.ts`:

```ts
import { test, expect } from 'vitest';
import { dispatch, dispatchWheel } from '../src/index';
import type { HitNode, CairnPointerEvent } from '../src/index';

function node(tag: string, log: string[], stopOn?: string): HitNode {
  return {
    layout: { offsetX: 0, offsetY: 0, size: { w: 10, h: 10 } },
    children: [],
    handlers: {
      onClick: (e: CairnPointerEvent) => {
        log.push(tag);
        if (tag === stopOn) e.stopPropagation();
      },
    },
  };
}

test('handlers fire in bubble order (target -> root)', () => {
  const log: string[] = [];
  const target = node('target', log);
  const mid = node('mid', log);
  const root = node('root', log);
  dispatch([target, mid, root], { type: 'click', x: 0, y: 0, button: 0, pointerType: 'mouse' });
  expect(log).toEqual(['target', 'mid', 'root']);
});

test('stopPropagation halts bubbling', () => {
  const log: string[] = [];
  const target = node('target', log, 'target');
  const mid = node('mid', log);
  const root = node('root', log);
  dispatch([target, mid, root], { type: 'click', x: 0, y: 0, button: 0, pointerType: 'mouse' });
  expect(log).toEqual(['target']);
});

test('target is path[0] and event carries coordinates', () => {
  let seen: CairnPointerEvent | undefined;
  const target: HitNode = {
    layout: { offsetX: 0, offsetY: 0, size: { w: 10, h: 10 } },
    children: [],
    handlers: { onPointerDown: (e) => (seen = e) },
  };
  dispatch([target], { type: 'pointerdown', x: 3, y: 4, button: 0, pointerType: 'mouse' });
  expect(seen?.target).toBe(target);
  expect(seen?.x).toBe(3);
  expect(seen?.y).toBe(4);
});

test('empty path is a no-op', () => {
  expect(() => dispatch([], { type: 'click', x: 0, y: 0, button: 0, pointerType: 'mouse' })).not.toThrow();
});

test('dispatchWheel calls onWheel in bubble order', () => {
  const log: string[] = [];
  const mk = (tag: string): HitNode => ({
    layout: { offsetX: 0, offsetY: 0, size: { w: 10, h: 10 } },
    children: [],
    handlers: { onWheel: () => log.push(tag) },
  });
  dispatchWheel([mk('a'), mk('b')], { x: 0, y: 0, deltaX: 0, deltaY: 5 });
  expect(log).toEqual(['a', 'b']);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run packages/events/test/dispatch.test.ts`
Expected: FAIL — `dispatch`/`dispatchWheel` not exported.

- [ ] **Step 3: Implement dispatch**

`packages/events/src/dispatch.ts`:

```ts
import type { HitNode, CairnPointerEvent, CairnWheelEvent, EventHandlers } from './event';

const POINTER_HANDLERS: Record<CairnPointerEvent['type'], keyof EventHandlers> = {
  pointerdown: 'onPointerDown',
  pointermove: 'onPointerMove',
  pointerup: 'onPointerUp',
  click: 'onClick',
};

// Bubble-only dispatch: build one event with target = path[0], walk target -> root,
// calling the matching handler until stopPropagation() is invoked.
export function dispatch(
  path: HitNode[],
  init: Omit<CairnPointerEvent, 'target' | 'stopPropagation'>,
): void {
  if (path.length === 0) return;
  let stopped = false;
  const event: CairnPointerEvent = {
    ...init,
    target: path[0],
    stopPropagation() {
      stopped = true;
    },
  };
  const key = POINTER_HANDLERS[init.type];
  for (const node of path) {
    if (stopped) break;
    const fn = node.handlers?.[key] as ((e: CairnPointerEvent) => void) | undefined;
    fn?.(event);
  }
}

export function dispatchWheel(
  path: HitNode[],
  init: Omit<CairnWheelEvent, 'target' | 'stopPropagation'>,
): void {
  if (path.length === 0) return;
  let stopped = false;
  const event: CairnWheelEvent = {
    ...init,
    target: path[0],
    stopPropagation() {
      stopped = true;
    },
  };
  for (const node of path) {
    if (stopped) break;
    node.handlers?.onWheel?.(event);
  }
}
```

- [ ] **Step 4: Export dispatch**

In `packages/events/src/index.ts`, add:

```ts
export { dispatch, dispatchWheel } from './dispatch';
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm vitest run packages/events/test/dispatch.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 6: Commit**

```bash
git add packages/events/src/dispatch.ts packages/events/src/index.ts \
  packages/events/test/dispatch.test.ts
git commit -m "feat(events): bubble dispatch + dispatchWheel with stopPropagation"
```

---

## Task 5: `nearestCommonAncestor` + `createPointerDispatcher`

**Files:**
- Create: `packages/events/src/pointer-dispatcher.ts`
- Modify: `packages/events/src/index.ts`
- Test: `packages/events/test/pointer-dispatcher.test.ts`

- [ ] **Step 1: Write the failing test**

`packages/events/test/pointer-dispatcher.test.ts`:

```ts
import { test, expect } from 'vitest';
import { createPointerDispatcher, nearestCommonAncestor } from '../src/index';
import type { HitNode, PointerInput } from '../src/index';

// root(100x100) > [ A(0,0 50x100) > a1(0,0 50x50), B(50,0 50x100) > b1(0,0 50x50) ]
function tree() {
  const log: string[] = [];
  const leaf = (tag: string, w: number, h: number, ox = 0, oy = 0): HitNode => ({
    layout: { offsetX: ox, offsetY: oy, size: { w, h } },
    children: [],
    handlers: {
      onPointerDown: () => log.push(`down:${tag}`),
      onPointerUp: () => log.push(`up:${tag}`),
      onClick: () => log.push(`click:${tag}`),
    },
  });
  const a1 = leaf('a1', 50, 50);
  const b1 = leaf('b1', 50, 50);
  const A: HitNode = { layout: { offsetX: 0, offsetY: 0, size: { w: 50, h: 100 } }, children: [a1], handlers: { onClick: () => log.push('click:A') } };
  const B: HitNode = { layout: { offsetX: 50, offsetY: 0, size: { w: 50, h: 100 } }, children: [b1], handlers: { onClick: () => log.push('click:B') } };
  const root: HitNode = { layout: { offsetX: 0, offsetY: 0, size: { w: 100, h: 100 } }, children: [A, B], handlers: { onClick: () => log.push('click:root') } };
  return { root, A, B, a1, b1, log };
}

const at = (type: PointerInput['type'], x: number, y: number): PointerInput => ({
  type, x, y, button: 0, pointerType: 'mouse',
});

test('nearestCommonAncestor returns the deepest shared node', () => {
  const root: HitNode = { layout: { offsetX: 0, offsetY: 0, size: { w: 1, h: 1 } }, children: [] };
  const mid: HitNode = { layout: { offsetX: 0, offsetY: 0, size: { w: 1, h: 1 } }, children: [] };
  const a: HitNode = { layout: { offsetX: 0, offsetY: 0, size: { w: 1, h: 1 } }, children: [] };
  const b: HitNode = { layout: { offsetX: 0, offsetY: 0, size: { w: 1, h: 1 } }, children: [] };
  expect(nearestCommonAncestor([a, mid, root], [b, mid, root])).toBe(mid);
});

test('down + up on the same target synthesizes a click on it', () => {
  const { root, log } = tree();
  const d = createPointerDispatcher(() => root);
  d.handlePointer(at('pointerdown', 10, 10));
  d.handlePointer(at('pointerup', 10, 10));
  expect(log).toEqual(['down:a1', 'up:a1', 'click:a1', 'click:A', 'click:root']);
});

test('down and up in different subtrees clicks their common ancestor', () => {
  const { root, log } = tree();
  const d = createPointerDispatcher(() => root);
  d.handlePointer(at('pointerdown', 10, 10)); // a1
  log.length = 0;
  d.handlePointer(at('pointerup', 60, 10)); // b1
  // up fires on b1's path; click bubbles from the common ancestor (root)
  expect(log).toEqual(['up:b1', 'click:root']);
});

test('pointerup with no prior down does not synthesize a click', () => {
  const { root, log } = tree();
  const d = createPointerDispatcher(() => root);
  d.handlePointer(at('pointerup', 10, 10));
  expect(log).toEqual(['up:a1']);
});

test('pointer events that miss everything are ignored', () => {
  const { root, log } = tree();
  const d = createPointerDispatcher(() => root);
  d.handlePointer(at('pointerdown', 999, 999));
  expect(log).toEqual([]);
});

test('handleWheel dispatches onWheel along the hit path', () => {
  const wheelLog: string[] = [];
  const leaf: HitNode = {
    layout: { offsetX: 0, offsetY: 0, size: { w: 100, h: 100 } },
    children: [],
    handlers: { onWheel: () => wheelLog.push('wheel') },
  };
  const d = createPointerDispatcher(() => leaf);
  d.handleWheel({ x: 10, y: 10, deltaX: 0, deltaY: 4 });
  expect(wheelLog).toEqual(['wheel']);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run packages/events/test/pointer-dispatcher.test.ts`
Expected: FAIL — `createPointerDispatcher`/`nearestCommonAncestor` not exported.

- [ ] **Step 3: Implement the dispatcher**

`packages/events/src/pointer-dispatcher.ts`:

```ts
import type { PointerInput, WheelInput } from '@cairn/host';
import type { HitNode } from './event';
import { hitTest } from './hit-test';
import { dispatch, dispatchWheel } from './dispatch';

// Both paths are ordered [target ... root]. The first node of `a` also present in
// `b` is therefore the deepest node they share.
export function nearestCommonAncestor(a: HitNode[], b: HitNode[]): HitNode | null {
  const inB = new Set(b);
  for (const node of a) {
    if (inB.has(node)) return node;
  }
  return null;
}

export interface PointerDispatcher {
  handlePointer(input: PointerInput): void;
  handleWheel(input: WheelInput): void;
}

// Translates raw pointer input into hit-tested bubble dispatch, synthesizing a
// `click` on pointerup at the nearest common ancestor of the down and up paths.
export function createPointerDispatcher(getRoot: () => HitNode): PointerDispatcher {
  let downPath: HitNode[] | null = null;

  return {
    handlePointer(input: PointerInput): void {
      const path = hitTest(getRoot(), input.x, input.y);
      if (path.length === 0) {
        // Missing the surface on release drops any pending down.
        if (input.type === 'pointerup') downPath = null;
        return;
      }

      dispatch(path, {
        type: input.type,
        x: input.x,
        y: input.y,
        button: input.button,
        pointerType: input.pointerType,
      });

      if (input.type === 'pointerdown') {
        downPath = path;
      } else if (input.type === 'pointerup') {
        if (downPath) {
          const nca = nearestCommonAncestor(downPath, path);
          if (nca) {
            const clickPath = path.slice(path.indexOf(nca));
            dispatch(clickPath, {
              type: 'click',
              x: input.x,
              y: input.y,
              button: input.button,
              pointerType: input.pointerType,
            });
          }
        }
        downPath = null;
      }
    },

    handleWheel(input: WheelInput): void {
      const path = hitTest(getRoot(), input.x, input.y);
      if (path.length === 0) return;
      dispatchWheel(path, {
        x: input.x,
        y: input.y,
        deltaX: input.deltaX,
        deltaY: input.deltaY,
      });
    },
  };
}
```

- [ ] **Step 4: Export the dispatcher**

In `packages/events/src/index.ts`, add:

```ts
export { createPointerDispatcher, nearestCommonAncestor } from './pointer-dispatcher';
export type { PointerDispatcher } from './pointer-dispatcher';
export type { PointerInput, WheelInput, PointerInputType, InputSource } from '@cairn/host';
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm vitest run packages/events/test/pointer-dispatcher.test.ts`
Expected: PASS (6 tests).
Run: `pnpm typecheck`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/events/src/pointer-dispatcher.ts packages/events/src/index.ts \
  packages/events/test/pointer-dispatcher.test.ts
git commit -m "feat(events): createPointerDispatcher + NCA click synthesis"
```

---

## Task 6: Runtime integration — `Instance.handlers` + mount wiring

**Files:**
- Modify: `packages/runtime/package.json` (add `@cairn/events` dep)
- Modify: `packages/runtime/src/instance.ts`
- Modify: `packages/runtime/src/mount.ts`
- Test: `packages/runtime/test/events.test.ts`

- [ ] **Step 1: Add the events dependency**

In `packages/runtime/package.json`, add to `dependencies`:

```json
    "@cairn/events": "workspace:*"
```

Then run: `pnpm install`

- [ ] **Step 2: Write the failing test**

`packages/runtime/test/events.test.ts`:

```ts
import { test, expect, afterEach } from 'vitest';
import { BoxNode } from '@cairn/layout';
import { mount, type Instance } from '../src/index';
import type { CairnPointerEvent } from '@cairn/events';
import { createFakeHost } from './fake-host';

let dispose: (() => void) | undefined;
afterEach(() => {
  dispose?.();
  dispose = undefined;
});

function makeButton(log: string[]): () => Instance {
  return () => {
    const layout = new BoxNode({ width: 50, height: 30 });
    return {
      layout,
      children: [],
      paintSelf() {},
      handlers: {
        onPointerDown: (e: CairnPointerEvent) => log.push(`down@${e.x},${e.y}`),
        onClick: () => log.push('click'),
      },
    };
  };
}

test('mount wires host.input to pointer dispatch', () => {
  const { host, input } = createFakeHost();
  const log: string[] = [];
  dispose = mount(makeButton(log), host);
  input.emitPointer({ type: 'pointerdown', x: 10, y: 5, button: 0, pointerType: 'mouse' });
  expect(log).toEqual(['down@10,5']);
});

test('down + up over the same instance synthesizes a click', () => {
  const { host, input } = createFakeHost();
  const log: string[] = [];
  dispose = mount(makeButton(log), host);
  input.emitPointer({ type: 'pointerdown', x: 10, y: 5, button: 0, pointerType: 'mouse' });
  input.emitPointer({ type: 'pointerup', x: 10, y: 5, button: 0, pointerType: 'mouse' });
  expect(log).toEqual(['down@10,5', 'click']);
});

test('dispose unsubscribes from input', () => {
  const { host, input } = createFakeHost();
  const log: string[] = [];
  dispose = mount(makeButton(log), host);
  dispose();
  dispose = undefined;
  input.emitPointer({ type: 'pointerdown', x: 10, y: 5, button: 0, pointerType: 'mouse' });
  expect(log).toEqual([]);
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `pnpm vitest run packages/runtime/test/events.test.ts`
Expected: FAIL — `Instance` has no `handlers` (type error) and/or mount does not dispatch.

- [ ] **Step 4: Add `handlers` to `Instance`**

Replace `packages/runtime/src/instance.ts` with:

```ts
import type { Renderer } from '@cairn/host';
import type { LayoutNode } from '@cairn/layout';
import type { EventHandlers } from '@cairn/events';

export interface Instance {
  layout: LayoutNode;
  paintSelf(r: Renderer): void;
  children: Instance[];
  handlers?: EventHandlers;
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

- [ ] **Step 5: Wire the dispatcher in `mount`**

In `packages/runtime/src/mount.ts`, add the import near the top:

```ts
import { createPointerDispatcher } from '@cairn/events';
```

After the `const unsubscribeResize = host.metrics.onResize(() => renderFrame());` line, add:

```ts
    const dispatcher = createPointerDispatcher(() => root);
    const unsubscribePointer = host.input.onPointer((e) => dispatcher.handlePointer(e));
    const unsubscribeWheel = host.input.onWheel((e) => dispatcher.handleWheel(e));
```

Replace the returned dispose function with:

```ts
    return () => {
      unsubscribePointer();
      unsubscribeWheel();
      unsubscribeResize(); // avoid re-render on a disposed tree
      setFrameRequester(null);
      dispose();
    };
```

- [ ] **Step 6: Run tests + typecheck to verify green**

Run: `pnpm vitest run packages/runtime/test/events.test.ts`
Expected: PASS (3 tests).
Run: `pnpm vitest run` (whole workspace — existing runtime tests still pass)
Expected: PASS.
Run: `pnpm typecheck`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add packages/runtime/package.json packages/runtime/src/instance.ts \
  packages/runtime/src/mount.ts packages/runtime/test/events.test.ts pnpm-lock.yaml
git commit -m "feat(runtime): Instance.handlers + mount pointer dispatch wiring"
```

---

## Task 7: Primitives — event props + `collectHandlers`

**Files:**
- Modify: `packages/primitives/package.json` (add `@cairn/events` dep)
- Create: `packages/primitives/src/events.ts`
- Modify: `packages/primitives/src/box.ts`
- Modify: `packages/primitives/src/text.ts`
- Modify: `packages/primitives/src/flex.ts`
- Modify: `packages/primitives/src/index.ts`
- Test: `packages/primitives/test/events.test.ts`

- [ ] **Step 1: Add the events dependency**

In `packages/primitives/package.json`, add to `dependencies`:

```json
    "@cairn/events": "workspace:*"
```

Then run: `pnpm install`

- [ ] **Step 2: Write the failing test**

`packages/primitives/test/events.test.ts`:

```ts
import { test, expect } from 'vitest';
import { Box, Text, Row } from '../src/index';

test('Box onClick populates instance.handlers', () => {
  const fn = () => {};
  const box = Box({ onClick: fn });
  expect(box.handlers?.onClick).toBe(fn);
});

test('Box with no event props has undefined handlers', () => {
  const box = Box({ style: { width: 10 } });
  expect(box.handlers).toBeUndefined();
});

test('Text collects onPointerDown', () => {
  const fn = () => {};
  const t = Text({ children: 'hi', onPointerDown: fn });
  expect(t.handlers?.onPointerDown).toBe(fn);
});

test('Row collects onWheel and onPointerUp only', () => {
  const wheel = () => {};
  const up = () => {};
  const row = Row({ onWheel: wheel, onPointerUp: up });
  expect(row.handlers?.onWheel).toBe(wheel);
  expect(row.handlers?.onPointerUp).toBe(up);
  expect(row.handlers?.onClick).toBeUndefined();
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `pnpm vitest run packages/primitives/test/events.test.ts`
Expected: FAIL — event props are not accepted / `handlers` not set.

- [ ] **Step 4: Create `collectHandlers`**

`packages/primitives/src/events.ts`:

```ts
import type { EventHandlers, CairnPointerEvent, CairnWheelEvent } from '@cairn/events';

// Event props shared by all primitives. Kept separate so each primitive's props
// interface can extend it.
export interface EventProps {
  onClick?: (e: CairnPointerEvent) => void;
  onPointerDown?: (e: CairnPointerEvent) => void;
  onPointerMove?: (e: CairnPointerEvent) => void;
  onPointerUp?: (e: CairnPointerEvent) => void;
  onWheel?: (e: CairnWheelEvent) => void;
}

// Build an EventHandlers object from the provided props, or undefined if none
// were given (so instances without listeners carry no handlers).
export function collectHandlers(props: EventProps): EventHandlers | undefined {
  const h: EventHandlers = {};
  let has = false;
  if (props.onClick) {
    h.onClick = props.onClick;
    has = true;
  }
  if (props.onPointerDown) {
    h.onPointerDown = props.onPointerDown;
    has = true;
  }
  if (props.onPointerMove) {
    h.onPointerMove = props.onPointerMove;
    has = true;
  }
  if (props.onPointerUp) {
    h.onPointerUp = props.onPointerUp;
    has = true;
  }
  if (props.onWheel) {
    h.onWheel = props.onWheel;
    has = true;
  }
  return has ? h : undefined;
}
```

- [ ] **Step 5: Wire event props into `Box`**

In `packages/primitives/src/box.ts`:

Add the import after the `resolveStyleInput` import:

```ts
import { collectHandlers, type EventProps } from './events';
```

Change `BoxProps` to extend `EventProps`:

```ts
export interface BoxProps extends EventProps {
  style?: StyleInput;
  children?: Instance;
}
```

In the returned instance object, add `handlers` after `children`:

```ts
  return {
    layout,
    children: child ? [child] : [],
    handlers: collectHandlers(props),
    paintSelf(r: Renderer) {
      if (s.backgroundColor) {
        r.fillRoundRect(
          { x: 0, y: 0, width: layout.size.w, height: layout.size.h },
          s.borderRadius ?? 0,
          { color: s.backgroundColor },
        );
      }
    },
  };
```

- [ ] **Step 6: Wire event props into `Text`**

In `packages/primitives/src/text.ts`:

Add the import after the `resolveStyleInput` import:

```ts
import { collectHandlers, type EventProps } from './events';
```

Change `TextProps` to extend `EventProps`:

```ts
export interface TextProps extends EventProps {
  children?: MaybeReactive<string | number>;
  value?: MaybeReactive<string | number>;
  style?: StyleInput;
}
```

In the returned instance object, add `handlers` after `children: []`:

```ts
  return {
    layout,
    children: [],
    handlers: collectHandlers(props),
    paintSelf(r: Renderer) {
      r.drawText(layout.text, { x: 0, y: 0 }, { font, color, baseline: 'top' });
    },
  };
```

- [ ] **Step 7: Wire event props into `Row`/`Column`**

In `packages/primitives/src/flex.ts`:

Add the import after the `resolveStyleInput` import:

```ts
import { collectHandlers, type EventProps } from './events';
```

Change `FlexProps` to extend `EventProps`:

```ts
export interface FlexProps extends EventProps {
  style?: StyleInput;
  children?: Instance | Instance[];
}
```

In the returned instance object inside `flex(...)`, add `handlers` after `children`:

```ts
  return {
    layout,
    children,
    handlers: collectHandlers(props),
    paintSelf() {
      // containers have no own visuals
    },
  };
```

- [ ] **Step 8: Export `EventProps`**

In `packages/primitives/src/index.ts`, add:

```ts
export { collectHandlers } from './events';
export type { EventProps } from './events';
```

- [ ] **Step 9: Run tests + typecheck to verify green**

Run: `pnpm vitest run packages/primitives/test/events.test.ts`
Expected: PASS (4 tests).
Run: `pnpm vitest run` (existing primitives tests still pass)
Expected: PASS.
Run: `pnpm typecheck`
Expected: PASS.

- [ ] **Step 10: Commit**

```bash
git add packages/primitives/package.json packages/primitives/src/events.ts \
  packages/primitives/src/box.ts packages/primitives/src/text.ts \
  packages/primitives/src/flex.ts packages/primitives/src/index.ts \
  packages/primitives/test/events.test.ts pnpm-lock.yaml
git commit -m "feat(primitives): onClick/onPointer*/onWheel props via collectHandlers"
```

---

## Task 8: `WebInputSource` + `createWebHost` + example

**Files:**
- Create: `packages/platform-web/src/web-input-source.ts`
- Modify: `packages/platform-web/src/create-web-host.ts`
- Modify: `packages/platform-web/src/index.ts`
- Modify: `examples/counter/main.tsx`
- Test: `packages/platform-web/test/web-input-source.test.ts`

- [ ] **Step 1: Write the failing test**

`packages/platform-web/test/web-input-source.test.ts`:

```ts
import { test, expect } from 'vitest';
import { WebInputSource } from '../src/index';
import type { PointerInput, WheelInput } from '@cairn/host';

// Minimal fake canvas: records listeners and returns a fixed bounding rect so we
// can assert coordinate conversion (client - rect origin).
function fakeCanvas() {
  const listeners: Record<string, (ev: unknown) => void> = {};
  const canvas = {
    addEventListener(type: string, cb: (ev: unknown) => void) {
      listeners[type] = cb;
    },
    removeEventListener(type: string) {
      delete listeners[type];
    },
    getBoundingClientRect() {
      return { left: 100, top: 50 };
    },
  };
  return { canvas: canvas as unknown as HTMLCanvasElement, listeners };
}

test('normalizes a pointerdown into surface-local coordinates', () => {
  const { canvas, listeners } = fakeCanvas();
  const src = new WebInputSource(canvas);
  const seen: PointerInput[] = [];
  src.onPointer((e) => seen.push(e));
  listeners.pointerdown({ clientX: 130, clientY: 70, button: 0, pointerType: 'mouse' });
  expect(seen).toEqual([{ type: 'pointerdown', x: 30, y: 20, button: 0, pointerType: 'mouse' }]);
});

test('maps pointermove and pointerup types', () => {
  const { canvas, listeners } = fakeCanvas();
  const src = new WebInputSource(canvas);
  const seen: string[] = [];
  src.onPointer((e) => seen.push(e.type));
  listeners.pointermove({ clientX: 100, clientY: 50, button: 0, pointerType: 'mouse' });
  listeners.pointerup({ clientX: 100, clientY: 50, button: 0, pointerType: 'mouse' });
  expect(seen).toEqual(['pointermove', 'pointerup']);
});

test('defaults missing pointerType to mouse', () => {
  const { canvas, listeners } = fakeCanvas();
  const src = new WebInputSource(canvas);
  let seen: PointerInput | undefined;
  src.onPointer((e) => (seen = e));
  listeners.pointerdown({ clientX: 100, clientY: 50, button: 0 });
  expect(seen?.pointerType).toBe('mouse');
});

test('normalizes wheel input with deltas', () => {
  const { canvas, listeners } = fakeCanvas();
  const src = new WebInputSource(canvas);
  const seen: WheelInput[] = [];
  src.onWheel((e) => seen.push(e));
  listeners.wheel({ clientX: 110, clientY: 60, deltaX: 1, deltaY: 8 });
  expect(seen).toEqual([{ x: 10, y: 10, deltaX: 1, deltaY: 8 }]);
});

test('unsubscribe stops delivery', () => {
  const { canvas, listeners } = fakeCanvas();
  const src = new WebInputSource(canvas);
  const seen: PointerInput[] = [];
  const off = src.onPointer((e) => seen.push(e));
  off();
  listeners.pointerdown({ clientX: 130, clientY: 70, button: 0, pointerType: 'mouse' });
  expect(seen).toEqual([]);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run packages/platform-web/test/web-input-source.test.ts`
Expected: FAIL — `WebInputSource` not exported.

- [ ] **Step 3: Implement `WebInputSource`**

`packages/platform-web/src/web-input-source.ts`:

```ts
import type {
  InputSource,
  PointerInput,
  PointerInputType,
  WheelInput,
} from '@cairn/host';

// Attaches DOM pointer/wheel listeners to a canvas and normalizes them into the
// DOM-free PointerInput/WheelInput contract. Coordinates are converted to logical
// px relative to the canvas top-left via getBoundingClientRect().
export class WebInputSource implements InputSource {
  private pointerCbs = new Set<(e: PointerInput) => void>();
  private wheelCbs = new Set<(e: WheelInput) => void>();

  constructor(private canvas: HTMLCanvasElement) {
    canvas.addEventListener('pointerdown', this.down);
    canvas.addEventListener('pointermove', this.move);
    canvas.addEventListener('pointerup', this.up);
    canvas.addEventListener('wheel', this.wheel);
  }

  onPointer(cb: (e: PointerInput) => void): () => void {
    this.pointerCbs.add(cb);
    return () => this.pointerCbs.delete(cb);
  }

  onWheel(cb: (e: WheelInput) => void): () => void {
    this.wheelCbs.add(cb);
    return () => this.wheelCbs.delete(cb);
  }

  dispose(): void {
    this.canvas.removeEventListener('pointerdown', this.down);
    this.canvas.removeEventListener('pointermove', this.move);
    this.canvas.removeEventListener('pointerup', this.up);
    this.canvas.removeEventListener('wheel', this.wheel);
  }

  private emitPointer(type: PointerInputType, ev: PointerEvent): void {
    const rect = this.canvas.getBoundingClientRect();
    const input: PointerInput = {
      type,
      x: ev.clientX - rect.left,
      y: ev.clientY - rect.top,
      button: ev.button,
      pointerType: (ev.pointerType as PointerInput['pointerType']) || 'mouse',
    };
    for (const cb of this.pointerCbs) cb(input);
  }

  private down = (ev: PointerEvent) => this.emitPointer('pointerdown', ev);
  private move = (ev: PointerEvent) => this.emitPointer('pointermove', ev);
  private up = (ev: PointerEvent) => this.emitPointer('pointerup', ev);

  private wheel = (ev: WheelEvent) => {
    const rect = this.canvas.getBoundingClientRect();
    const input: WheelInput = {
      x: ev.clientX - rect.left,
      y: ev.clientY - rect.top,
      deltaX: ev.deltaX,
      deltaY: ev.deltaY,
    };
    for (const cb of this.wheelCbs) cb(input);
  };
}
```

- [ ] **Step 4: Use `WebInputSource` in `createWebHost`**

In `packages/platform-web/src/create-web-host.ts`, add the import:

```ts
import { WebInputSource } from './web-input-source';
```

Replace the placeholder `input` block (added in Task 1) with:

```ts
  const input = new WebInputSource(canvas);

  return { renderer, scheduler, metrics, input };
```

- [ ] **Step 5: Export `WebInputSource`**

In `packages/platform-web/src/index.ts`, add:

```ts
export { WebInputSource } from './web-input-source';
```

- [ ] **Step 6: Run tests + typecheck to verify green**

Run: `pnpm vitest run packages/platform-web/test/web-input-source.test.ts`
Expected: PASS (5 tests).
Run: `pnpm typecheck`
Expected: PASS.

- [ ] **Step 7: Update the counter example to use a real `<Box onClick>`**

Replace `examples/counter/main.tsx` with:

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
      <Box
        style={{ backgroundColor: '#3b82f6', borderRadius: 16, padding: 24 }}
        onClick={() => setCount(count() + 1)}
      >
        <Column style={{ gap: 8, align: 'center' }}>
          <Text style={{ font: 'bold 20px sans-serif', color: '#e0e7ff' }}>Cairn counter</Text>
          <Text style={{ font: '64px sans-serif', color: '#ffffff' }}>{() => String(count())}</Text>
        </Column>
      </Box>
    </Column>
  );
}

mount(App, host);
```

- [ ] **Step 8: Full workspace green**

Run: `pnpm vitest run`
Expected: PASS (all packages, including the new events/runtime/primitives/platform-web tests).
Run: `pnpm typecheck`
Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add packages/platform-web/src/web-input-source.ts \
  packages/platform-web/src/create-web-host.ts packages/platform-web/src/index.ts \
  packages/platform-web/test/web-input-source.test.ts examples/counter/main.tsx
git commit -m "feat(platform-web): WebInputSource + real onClick counter example"
```

---

## Exit Criteria

- `@cairn/events` built DOM-free: `hitTest` (bubble path, topmost-wins) + `dispatch`/`dispatchWheel` (bubble + stopPropagation) + `createPointerDispatcher` (NCA click synthesis).
- `InputSource` on `Host`; `WebInputSource` in platform-web converts DOM events to logical coordinates.
- Runtime `mount` subscribes the dispatcher; `Instance.handlers` carries listeners; dispose unsubscribes.
- Primitives accept `onClick`/`onPointer*`/`onWheel` populating `instance.handlers`.
- `pnpm vitest run` + `pnpm typecheck` green across the workspace.
- `examples/counter` increments via a real `<Box onClick>` (manual browser check).

## Out of Scope (7b / 7c and later)

- Hover state + reactive restyle (7b); focus / Tab / focus-ring / keyboard (7c).
- Capture phase, pointer capture / drag, overflow-aware hit-testing, multi-touch gestures.
