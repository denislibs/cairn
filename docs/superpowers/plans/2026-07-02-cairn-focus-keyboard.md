# Cairn Phase 7c — Focus + Tab + Keyboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add keyboard input + focus management — a keyboard seam, a focus manager (click-to-focus, Tab/Shift+Tab, blur-on-empty), key-event delivery to the focused element, and a live `focus` style variant. Completes milestone M4.

**Architecture:** A DOM `KeyboardInput` seam feeds `host.input.onKey`. A DOM-free `createFocusManager` owns `focusedPath`, fires non-bubbling `onFocus`/`onBlur`, moves focus on Tab (tree order via `collectFocusables`), and bubbles key events focused→root via `dispatchKey`. `mount` wires the focus manager to `onKey` and to a new pointerdown hook on the dispatcher. Primitives reuse the 7b `createInteractive` machinery — a `focused` signal adds `'focus'` to the active states.

**Tech Stack:** TypeScript (strict), pnpm workspaces, Vitest. Reactivity effects flush synchronously. Boolean `focusable`; Tab order = DFS pre-order.

**Spec:** `docs/superpowers/specs/2026-07-02-cairn-focus-keyboard-design.md`

---

## File Structure

**`@cairn/host`:** `input.ts` (+`KeyboardInput`/`KeyInputType`, `InputSource.onKey`), `index.ts` (exports).
**`@cairn/events`:** `event.ts` (+`focusable` on HitNode, `CairnKeyboardEvent`, `CairnFocusEvent`, handlers), `dispatch.ts` (+`dispatchKey`), `focus.ts` (new: `collectFocusables`, `createFocusManager`), `pointer-dispatcher.ts` (+`onPointerDown` hook), `index.ts`.
**`@cairn/runtime`:** `instance.ts` (+`focusable`), `mount.ts` (focus wiring), `test/fake-host.ts` (fake `onKey`).
**`@cairn/primitives`:** `events.ts` (+key/focus props), `interactive.ts` (+`focused`), `box.ts`/`text.ts`/`flex.ts` (+`focusable` prop), `test/fake-host.ts` (fake `onKey`).
**`@cairn/platform-web`:** `web-input-source.ts` (keyboard + tabIndex).
**Tests/fixtures also touched in Task 1:** `packages/host/test/conformance.test.ts`.
**example:** `examples/counter/main.tsx`.

---

## Task 1: Host — keyboard seam (`KeyboardInput` + `InputSource.onKey`)

**Files:**
- Modify: `packages/host/src/input.ts`, `packages/host/src/index.ts`
- Modify (keep workspace green — all `InputSource` implementers): `packages/runtime/test/fake-host.ts`, `packages/primitives/test/fake-host.ts`, `packages/host/test/conformance.test.ts`, `packages/platform-web/src/web-input-source.ts`
- Test: `packages/host/test/keyboard-input.test.ts`

`InputSource.onKey` is **required**; this task stubs it in every implementer (WebInputSource gets a temporary no-op replaced in Task 7).

- [ ] **Step 1: Write the failing test** — `packages/host/test/keyboard-input.test.ts`:

```ts
import { test, expect } from 'vitest';
import type { InputSource, KeyboardInput } from '../src/index';

function makeStub(): InputSource {
  const keys = new Set<(e: KeyboardInput) => void>();
  return {
    onPointer: () => () => {},
    onWheel: () => () => {},
    onKey(cb) {
      keys.add(cb);
      return () => keys.delete(cb);
    },
  };
}

test('InputSource.onKey is implementable with unsubscribe', () => {
  const src = makeStub();
  const off = src.onKey(() => {});
  expect(typeof off).toBe('function');
  off();
});

test('KeyboardInput shape is usable', () => {
  let prevented = false;
  const k: KeyboardInput = {
    type: 'keydown',
    key: 'Tab',
    code: 'Tab',
    shift: false,
    ctrl: false,
    alt: false,
    meta: false,
    preventDefault: () => {
      prevented = true;
    },
  };
  k.preventDefault();
  expect(k.type).toBe('keydown');
  expect(prevented).toBe(true);
});
```

- [ ] **Step 2: Run to verify FAIL**

Run: `pnpm vitest run packages/host/test/keyboard-input.test.ts`
Expected: FAIL — `KeyboardInput`/`onKey` not exported.

- [ ] **Step 3: Add the keyboard types** — in `packages/host/src/input.ts`, append:

```ts
export type KeyInputType = 'keydown' | 'keyup';

export interface KeyboardInput {
  type: KeyInputType;
  key: string; // 'Tab', 'Enter', 'a', 'ArrowDown'
  code: string; // physical key, e.g. 'KeyA'
  shift: boolean;
  ctrl: boolean;
  alt: boolean;
  meta: boolean;
  preventDefault(): void; // synchronously calls the DOM event's preventDefault
}
```

Add `onKey` to the `InputSource` interface (after `onWheel`):

```ts
  onKey(cb: (e: KeyboardInput) => void): () => void; // returns unsubscribe
```

- [ ] **Step 4: Export the new types** — in `packages/host/src/index.ts`, change the input export line to:

```ts
export type { InputSource, PointerInput, WheelInput, PointerInputType, KeyboardInput, KeyInputType } from './input';
```

- [ ] **Step 5: Fix `runtime/test/fake-host.ts`** — extend the `@cairn/host` type import to add `KeyboardInput`, and update `createFakeInput` to also handle keys:

Add `KeyboardInput` to the imported type list. Then in `createFakeInput`, add a key channel:

```ts
export function createFakeInput() {
  const pointerCbs = new Set<(e: PointerInput) => void>();
  const wheelCbs = new Set<(e: WheelInput) => void>();
  const keyCbs = new Set<(e: KeyboardInput) => void>();
  const input: InputSource = {
    onPointer(cb) {
      pointerCbs.add(cb);
      return () => pointerCbs.delete(cb);
    },
    onWheel(cb) {
      wheelCbs.add(cb);
      return () => wheelCbs.delete(cb);
    },
    onKey(cb) {
      keyCbs.add(cb);
      return () => keyCbs.delete(cb);
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
    emitKey(e: KeyboardInput) {
      for (const cb of keyCbs) cb(e);
    },
  };
}
```

- [ ] **Step 6: Fix the two no-op input stubs**

In `packages/primitives/test/fake-host.ts` line 21, change the input literal to:

```ts
  const input = { onPointer: () => () => {}, onWheel: () => () => {}, onKey: () => () => {} };
```

In `packages/host/test/conformance.test.ts` (~line 62), change the input literal to:

```ts
  const input = { onPointer: () => () => {}, onWheel: () => () => {}, onKey: () => () => {} };
```

- [ ] **Step 7: Add a temporary `onKey` stub to `WebInputSource`** — in `packages/platform-web/src/web-input-source.ts`, add this method after `onWheel` (real implementation lands in Task 7):

```ts
  // Placeholder; real keyboard wiring added in Task 7.
  onKey(): () => void {
    return () => {};
  }
```

- [ ] **Step 8: Verify green**

Run: `pnpm vitest run packages/host/test/keyboard-input.test.ts` → PASS (2).
Run: `pnpm typecheck` → PASS (WebInputSource now satisfies InputSource incl. onKey).
Run: `pnpm vitest run` → PASS (all).

- [ ] **Step 9: Commit**

```bash
git add packages/host/src/input.ts packages/host/src/index.ts packages/host/test/keyboard-input.test.ts packages/runtime/test/fake-host.ts packages/primitives/test/fake-host.ts packages/host/test/conformance.test.ts packages/platform-web/src/web-input-source.ts
git commit -m "feat(host): keyboard seam — KeyboardInput + InputSource.onKey"
```

---

## Task 2: Events — focus/keyboard model + `dispatchKey`

**Files:**
- Modify: `packages/events/src/event.ts`, `packages/events/src/dispatch.ts`, `packages/events/src/index.ts`
- Test: `packages/events/test/dispatch-key.test.ts`

- [ ] **Step 1: Write the failing test** — `packages/events/test/dispatch-key.test.ts`:

```ts
import { test, expect } from 'vitest';
import { dispatchKey } from '../src/index';
import type { HitNode, CairnKeyboardEvent } from '../src/index';

function node(tag: string, log: string[], stopOn?: string): HitNode {
  return {
    layout: { offsetX: 0, offsetY: 0, size: { w: 10, h: 10 } },
    children: [],
    handlers: {
      onKeyDown: (e: CairnKeyboardEvent) => {
        log.push(tag);
        if (tag === stopOn) e.stopPropagation();
      },
    },
  };
}

const init = (over: Partial<CairnKeyboardEvent> = {}) => ({
  type: 'keydown' as const,
  key: 'Enter',
  code: 'Enter',
  shift: false,
  ctrl: false,
  alt: false,
  meta: false,
  preventDefault: () => {},
  ...over,
});

test('keydown bubbles focused -> root, mapped to onKeyDown', () => {
  const log: string[] = [];
  dispatchKey([node('target', log), node('mid', log), node('root', log)], init());
  expect(log).toEqual(['target', 'mid', 'root']);
});

test('stopPropagation halts bubbling', () => {
  const log: string[] = [];
  dispatchKey([node('target', log, 'target'), node('mid', log)], init());
  expect(log).toEqual(['target']);
});

test('target is path[0]; preventDefault forwards to the raw input', () => {
  let prevented = false;
  let seen: CairnKeyboardEvent | undefined;
  const target: HitNode = {
    layout: { offsetX: 0, offsetY: 0, size: { w: 1, h: 1 } },
    children: [],
    handlers: { onKeyDown: (e) => { seen = e; e.preventDefault(); } },
  };
  dispatchKey([target], init({ preventDefault: () => { prevented = true; } }));
  expect(seen?.target).toBe(target);
  expect(prevented).toBe(true);
});

test('keyup maps to onKeyUp', () => {
  const log: string[] = [];
  const n: HitNode = {
    layout: { offsetX: 0, offsetY: 0, size: { w: 1, h: 1 } },
    children: [],
    handlers: { onKeyUp: () => log.push('up') },
  };
  dispatchKey([n], init({ type: 'keyup' }));
  expect(log).toEqual(['up']);
});
```

- [ ] **Step 2: Run to verify FAIL**

Run: `pnpm vitest run packages/events/test/dispatch-key.test.ts`
Expected: FAIL — `dispatchKey`/`CairnKeyboardEvent` not exported.

- [ ] **Step 3: Extend the event model** — in `packages/events/src/event.ts`:

Add `focusable` to `HitNode` (after `handlers?`):

```ts
export interface HitNode {
  layout: { offsetX: number; offsetY: number; size: { w: number; h: number } };
  children: HitNode[];
  handlers?: EventHandlers;
  focusable?: boolean;
}
```

Add the two new event interfaces (after `CairnWheelEvent`):

```ts
export interface CairnKeyboardEvent {
  type: 'keydown' | 'keyup';
  key: string;
  code: string;
  shift: boolean;
  ctrl: boolean;
  alt: boolean;
  meta: boolean;
  target: HitNode;
  stopPropagation(): void;
  preventDefault(): void;
}

export interface CairnFocusEvent {
  target: HitNode;
}
```

Add handlers to `EventHandlers` (after `onPointerLeave?`):

```ts
  onKeyDown?(e: CairnKeyboardEvent): void;
  onKeyUp?(e: CairnKeyboardEvent): void;
  onFocus?(e: CairnFocusEvent): void;
  onBlur?(e: CairnFocusEvent): void;
```

- [ ] **Step 4: Add `dispatchKey`** — in `packages/events/src/dispatch.ts`:

Add `CairnKeyboardEvent` to the type import from `./event`. Then append:

```ts
const KEY_HANDLERS: Record<CairnKeyboardEvent['type'], keyof EventHandlers> = {
  keydown: 'onKeyDown',
  keyup: 'onKeyUp',
};

/** Bubble-only keyboard dispatch: keydown/keyup mapped along path[0] -> root. */
export function dispatchKey(
  path: HitNode[],
  init: Omit<CairnKeyboardEvent, 'target' | 'stopPropagation'>,
): void {
  if (path.length === 0) return;
  let stopped = false;
  const event: CairnKeyboardEvent = {
    ...init,
    target: path[0],
    stopPropagation() {
      stopped = true;
    },
  };
  const key = KEY_HANDLERS[init.type];
  for (const node of path) {
    if (stopped) break;
    const fn = node.handlers?.[key] as ((e: CairnKeyboardEvent) => void) | undefined;
    fn?.(event);
  }
}
```

- [ ] **Step 5: Export** — in `packages/events/src/index.ts`:

Change the event-type export to add the two new types:

```ts
export type { HitNode, CairnPointerEvent, CairnWheelEvent, CairnKeyboardEvent, CairnFocusEvent, EventHandlers } from './event';
```

Change the dispatch export to add `dispatchKey`:

```ts
export { dispatch, dispatchWheel, dispatchTo, dispatchKey } from './dispatch';
```

- [ ] **Step 6: Verify green**

Run: `pnpm vitest run packages/events/test/dispatch-key.test.ts` → PASS (4).
Run: `pnpm typecheck` → PASS.
Run: `pnpm vitest run packages/events` → existing events tests still PASS.

- [ ] **Step 7: Commit**

```bash
git add packages/events/src/event.ts packages/events/src/dispatch.ts packages/events/src/index.ts packages/events/test/dispatch-key.test.ts
git commit -m "feat(events): keyboard/focus event model + dispatchKey"
```

---

## Task 3: Events — `collectFocusables` + `createFocusManager`

**Files:**
- Create: `packages/events/src/focus.ts`
- Modify: `packages/events/src/index.ts`
- Test: `packages/events/test/focus.test.ts`

- [ ] **Step 1: Write the failing test** — `packages/events/test/focus.test.ts`:

```ts
import { test, expect } from 'vitest';
import { collectFocusables, createFocusManager } from '../src/index';
import type { HitNode, KeyboardInput } from '../src/index';

// root > [ A(focusable) > a1, B(focusable) ]
function tree() {
  const log: string[] = [];
  const fh = (tag: string) => ({
    onFocus: () => log.push(`focus:${tag}`),
    onBlur: () => log.push(`blur:${tag}`),
    onKeyDown: () => log.push(`key:${tag}`),
  });
  const box = (w = 10, h = 10, ox = 0, oy = 0): HitNode['layout'] => ({ offsetX: ox, offsetY: oy, size: { w, h } });
  const a1: HitNode = { layout: box(), children: [] };
  const A: HitNode = { layout: box(50, 100), children: [a1], focusable: true, handlers: fh('A') };
  const B: HitNode = { layout: box(50, 100, 50), children: [], focusable: true, handlers: fh('B') };
  const root: HitNode = { layout: box(100, 100), children: [A, B] };
  return { root, A, B, a1, log };
}

const key = (over: Partial<KeyboardInput> = {}): KeyboardInput => ({
  type: 'keydown', key: 'Tab', code: 'Tab', shift: false, ctrl: false, alt: false, meta: false,
  preventDefault: () => {}, ...over,
});

test('collectFocusables returns focusables in pre-order with [node..root] paths', () => {
  const { root, A, B } = tree();
  const list = collectFocusables(root);
  expect(list.map((f) => f.node)).toEqual([A, B]);
  expect(list[0].path).toEqual([A, root]);
  expect(list[1].path).toEqual([B, root]);
});

test('focusFromPointer focuses the nearest focusable ancestor', () => {
  const { root, A, a1, log } = tree();
  const fm = createFocusManager(() => root);
  fm.focusFromPointer([a1, A, root]); // clicked a1 (not focusable) inside A (focusable)
  expect(fm.focused()).toBe(A);
  expect(log).toEqual(['focus:A']);
});

test('focusFromPointer with no focusable in path blurs the current focus', () => {
  const { root, A, B, log } = tree();
  const fm = createFocusManager(() => root);
  fm.focusFromPointer([A, root]);
  log.length = 0;
  fm.focusFromPointer([root]); // nothing focusable
  expect(fm.focused()).toBe(null);
  expect(log).toEqual(['blur:A']);
});

test('Tab cycles focusables in order and wraps; Shift+Tab reverses', () => {
  const { root, A, B } = tree();
  const fm = createFocusManager(() => root);
  fm.handleKey(key()); // nothing focused -> first (A)
  expect(fm.focused()).toBe(A);
  fm.handleKey(key()); // A -> B
  expect(fm.focused()).toBe(B);
  fm.handleKey(key()); // B -> wrap to A
  expect(fm.focused()).toBe(A);
  fm.handleKey(key({ shift: true })); // A -> wrap back to B
  expect(fm.focused()).toBe(B);
});

test('Tab calls preventDefault', () => {
  const { root } = tree();
  const fm = createFocusManager(() => root);
  let prevented = false;
  fm.handleKey(key({ preventDefault: () => { prevented = true; } }));
  expect(prevented).toBe(true);
});

test('non-Tab keys bubble to the focused node', () => {
  const { root, A, log } = tree();
  const fm = createFocusManager(() => root);
  fm.focusFromPointer([A, root]);
  log.length = 0;
  fm.handleKey(key({ key: 'Enter', code: 'Enter' }));
  expect(log).toEqual(['key:A']);
});
```

- [ ] **Step 2: Run to verify FAIL**

Run: `pnpm vitest run packages/events/test/focus.test.ts`
Expected: FAIL — `collectFocusables`/`createFocusManager` not exported.

- [ ] **Step 3: Implement** — `packages/events/src/focus.ts`:

```ts
import type { KeyboardInput } from '@cairn/host';
import type { HitNode } from './event';
import { dispatchKey } from './dispatch';

export interface FocusEntry {
  node: HitNode;
  path: HitNode[]; // [node ... root]
}

// DFS pre-order; each focusable node paired with its bubble path.
export function collectFocusables(root: HitNode): FocusEntry[] {
  const out: FocusEntry[] = [];
  const walk = (node: HitNode, ancestors: HitNode[]): void => {
    const path = [node, ...ancestors];
    if (node.focusable) out.push({ node, path });
    for (const child of node.children) walk(child, path);
  };
  walk(root, []);
  return out;
}

export interface FocusManager {
  focused(): HitNode | null;
  blur(): void;
  focusFromPointer(path: HitNode[]): void;
  handleKey(input: KeyboardInput): void;
}

// Owns the currently focused node. focus/blur are non-bubbling; key events bubble
// from the focused node to the root; Tab moves focus in tree order.
export function createFocusManager(getRoot: () => HitNode): FocusManager {
  let focusedPath: HitNode[] | null = null;

  const current = (): HitNode | null => (focusedPath ? focusedPath[0] : null);

  const focus = (path: HitNode[]): void => {
    const next = path.length > 0 ? path[0] : null;
    const prev = current();
    if (next === prev) return;
    if (prev) prev.handlers?.onBlur?.({ target: prev });
    focusedPath = next ? path : null;
    if (next) next.handlers?.onFocus?.({ target: next });
  };

  const blur = (): void => {
    const prev = current();
    if (prev) prev.handlers?.onBlur?.({ target: prev });
    focusedPath = null;
  };

  return {
    focused: current,
    blur,
    focusFromPointer(path: HitNode[]): void {
      const idx = path.findIndex((n) => n.focusable);
      if (idx === -1) {
        blur();
        return;
      }
      focus(path.slice(idx));
    },
    handleKey(input: KeyboardInput): void {
      if (input.type === 'keydown' && input.key === 'Tab') {
        input.preventDefault();
        const list = collectFocusables(getRoot());
        if (list.length === 0) return;
        const node = current();
        const index = node ? list.findIndex((f) => f.node === node) : -1;
        let nextIndex: number;
        if (index === -1) {
          nextIndex = input.shift ? list.length - 1 : 0;
        } else {
          nextIndex = (index + (input.shift ? -1 : 1) + list.length) % list.length;
        }
        focus(list[nextIndex].path);
        return;
      }
      if (focusedPath) {
        dispatchKey(focusedPath, {
          type: input.type,
          key: input.key,
          code: input.code,
          shift: input.shift,
          ctrl: input.ctrl,
          alt: input.alt,
          meta: input.meta,
          preventDefault: input.preventDefault,
        });
      }
    },
  };
}
```

- [ ] **Step 4: Export** — in `packages/events/src/index.ts`, add:

```ts
export { collectFocusables, createFocusManager } from './focus';
export type { FocusManager, FocusEntry } from './focus';
export type { KeyboardInput, KeyInputType } from '@cairn/host';
```

- [ ] **Step 5: Verify green**

Run: `pnpm vitest run packages/events/test/focus.test.ts` → PASS (6).
Run: `pnpm typecheck` → PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/events/src/focus.ts packages/events/src/index.ts packages/events/test/focus.test.ts
git commit -m "feat(events): collectFocusables + createFocusManager (Tab, click-to-focus, key bubbling)"
```

---

## Task 4: Events — `onPointerDown` hook on the dispatcher

**Files:**
- Modify: `packages/events/src/pointer-dispatcher.ts`
- Test: `packages/events/test/pointer-hook.test.ts`

- [ ] **Step 1: Write the failing test** — `packages/events/test/pointer-hook.test.ts`:

```ts
import { test, expect } from 'vitest';
import { createPointerDispatcher } from '../src/index';
import type { HitNode, PointerInput } from '../src/index';

const root: HitNode = { layout: { offsetX: 0, offsetY: 0, size: { w: 100, h: 100 } }, children: [] };
const down = (x: number, y: number): PointerInput => ({ type: 'pointerdown', x, y, button: 0, pointerType: 'mouse' });

test('onPointerDown hook fires with the hit path on pointerdown', () => {
  const paths: HitNode[][] = [];
  const d = createPointerDispatcher(() => root, { onPointerDown: (p) => paths.push(p) });
  d.handlePointer(down(10, 10));
  expect(paths).toEqual([[root]]);
});

test('onPointerDown hook fires with an empty path when the pointer misses (for blur)', () => {
  const paths: HitNode[][] = [];
  const d = createPointerDispatcher(() => root, { onPointerDown: (p) => paths.push(p) });
  d.handlePointer(down(999, 999));
  expect(paths).toEqual([[]]);
});

test('hook does not fire on pointermove/up', () => {
  const paths: HitNode[][] = [];
  const d = createPointerDispatcher(() => root, { onPointerDown: (p) => paths.push(p) });
  d.handlePointer({ type: 'pointermove', x: 10, y: 10, button: 0, pointerType: 'mouse' });
  d.handlePointer({ type: 'pointerup', x: 10, y: 10, button: 0, pointerType: 'mouse' });
  expect(paths).toEqual([]);
});
```

- [ ] **Step 2: Run to verify FAIL**

Run: `pnpm vitest run packages/events/test/pointer-hook.test.ts`
Expected: FAIL — `createPointerDispatcher` takes no hooks arg / hook never called.

- [ ] **Step 3: Add the hook** — in `packages/events/src/pointer-dispatcher.ts`:

Add an interface (after `PointerDispatcher`):

```ts
export interface PointerDispatcherHooks {
  onPointerDown?(path: HitNode[]): void; // fires on every pointerdown, incl. empty path
}
```

Change the signature and add the hook call. Update the function to accept hooks:

```ts
export function createPointerDispatcher(
  getRoot: () => HitNode,
  hooks?: PointerDispatcherHooks,
): PointerDispatcher {
```

Inside `handlePointer`, right after `syncHover(path, input);` and BEFORE the empty-path guard, add:

```ts
      if (input.type === 'pointerdown') hooks?.onPointerDown?.(path);
```

(The rest is unchanged.)

- [ ] **Step 4: Verify green**

Run: `pnpm vitest run packages/events/test/pointer-hook.test.ts` → PASS (3).
Run: `pnpm vitest run packages/events` → existing dispatcher/click/hover tests still PASS.
Run: `pnpm typecheck` → PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/events/src/pointer-dispatcher.ts packages/events/test/pointer-hook.test.ts
git commit -m "feat(events): optional onPointerDown hook on the pointer dispatcher"
```

---

## Task 5: Runtime — `Instance.focusable` + mount focus wiring

**Files:**
- Modify: `packages/runtime/src/instance.ts`, `packages/runtime/src/mount.ts`
- Test: `packages/runtime/test/focus.test.ts`

- [ ] **Step 1: Write the failing test** — `packages/runtime/test/focus.test.ts`:

```ts
import { test, expect, afterEach } from 'vitest';
import { BoxNode } from '@cairn/layout';
import { mount, type Instance } from '../src/index';
import type { CairnKeyboardEvent, CairnFocusEvent } from '@cairn/events';
import { createFakeHost } from './fake-host';

let dispose: (() => void) | undefined;
afterEach(() => {
  dispose?.();
  dispose = undefined;
});

function makeFocusable(log: string[]): () => Instance {
  return () => {
    const layout = new BoxNode({ width: 50, height: 30 });
    return {
      layout,
      children: [],
      focusable: true,
      paintSelf() {},
      handlers: {
        onFocus: (_e: CairnFocusEvent) => log.push('focus'),
        onKeyDown: (e: CairnKeyboardEvent) => log.push(`key:${e.key}`),
      },
    };
  };
}

test('pointerdown over a focusable instance focuses it', () => {
  const { host, input } = createFakeHost();
  const log: string[] = [];
  dispose = mount(makeFocusable(log), host);
  input.emitPointer({ type: 'pointerdown', x: 10, y: 5, button: 0, pointerType: 'mouse' });
  expect(log).toContain('focus');
});

test('keydown routes to the focused instance', () => {
  const { host, input } = createFakeHost();
  const log: string[] = [];
  dispose = mount(makeFocusable(log), host);
  input.emitPointer({ type: 'pointerdown', x: 10, y: 5, button: 0, pointerType: 'mouse' });
  input.emitKey({ type: 'keydown', key: 'Enter', code: 'Enter', shift: false, ctrl: false, alt: false, meta: false, preventDefault: () => {} });
  expect(log).toContain('key:Enter');
});
```

- [ ] **Step 2: Run to verify FAIL**

Run: `pnpm vitest run packages/runtime/test/focus.test.ts`
Expected: FAIL — `Instance` has no `focusable` and mount does not route keys/focus.

- [ ] **Step 3: Add `focusable` to `Instance`** — in `packages/runtime/src/instance.ts`, add to the interface (after `handlers?`):

```ts
  focusable?: boolean;
```

- [ ] **Step 4: Wire the focus manager in `mount`** — in `packages/runtime/src/mount.ts`:

Change the events import to add `createFocusManager`:

```ts
import { createPointerDispatcher, createFocusManager } from '@cairn/events';
```

Replace the dispatcher/subscription block (the three `const dispatcher …` / `unsubscribePointer` / `unsubscribeWheel` lines) with:

```ts
    const focus = createFocusManager(() => root);
    const dispatcher = createPointerDispatcher(() => root, {
      onPointerDown: (path) => focus.focusFromPointer(path),
    });
    const unsubscribePointer = host.input.onPointer((e) => dispatcher.handlePointer(e));
    const unsubscribeWheel = host.input.onWheel((e) => dispatcher.handleWheel(e));
    const unsubscribeKey = host.input.onKey((e) => focus.handleKey(e));
```

Add `unsubscribeKey()` to the dispose function (before `unsubscribeResize()`):

```ts
    return () => {
      unsubscribePointer();
      unsubscribeWheel();
      unsubscribeKey();
      unsubscribeResize(); // avoid re-render on a disposed tree
      setFrameRequester(null);
      dispose();
    };
```

- [ ] **Step 5: Verify green**

Run: `pnpm vitest run packages/runtime/test/focus.test.ts` → PASS (2).
Run: `pnpm vitest run packages/runtime` → existing runtime tests still PASS.
Run: `pnpm typecheck` → PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/runtime/src/instance.ts packages/runtime/src/mount.ts packages/runtime/test/focus.test.ts
git commit -m "feat(runtime): Instance.focusable + mount focus/keyboard wiring"
```

---

## Task 6: Primitives — focus support (`focusable` prop + `focus` state + key handlers)

**Files:**
- Modify: `packages/primitives/src/events.ts`, `packages/primitives/src/interactive.ts`
- Modify: `packages/primitives/src/box.ts`, `packages/primitives/src/text.ts`, `packages/primitives/src/flex.ts`
- Test: `packages/primitives/test/focus.test.ts`

- [ ] **Step 1: Add key/focus props to `EventProps`** — in `packages/primitives/src/events.ts`:

Change the import to add the keyboard/focus event types:

```ts
import type { EventHandlers, CairnPointerEvent, CairnWheelEvent, CairnKeyboardEvent, CairnFocusEvent } from '@cairn/events';
```

Add to `EventProps` (after `onWheel?`):

```ts
  onKeyDown?: (e: CairnKeyboardEvent) => void;
  onKeyUp?: (e: CairnKeyboardEvent) => void;
  onFocus?: (e: CairnFocusEvent) => void;
  onBlur?: (e: CairnFocusEvent) => void;
```

(Leave `collectHandlers` unchanged.)

- [ ] **Step 2: Write the failing test** — `packages/primitives/test/focus.test.ts`:

```ts
import { test, expect } from 'vitest';
import { createRoot } from '@cairn/reactivity';
import { setFrameRequester } from '@cairn/runtime';
import type { CairnFocusEvent, CairnKeyboardEvent } from '@cairn/events';
import { Box, createInteractive } from '../src/index';

const fe = {} as CairnFocusEvent;
const ke = {} as CairnKeyboardEvent;

test('createInteractive: onFocus activates the focus variant; blur reverts', () => {
  const { resolved, handlers } = createInteractive({
    style: { backgroundColor: '#fff', focus: { backgroundColor: '#00f' } },
  });
  handlers.onFocus!(fe);
  expect(resolved().backgroundColor).toBe('#00f');
  handlers.onBlur!(fe);
  expect(resolved().backgroundColor).toBe('#fff');
});

test('createInteractive passes onKeyDown through to the user handler', () => {
  const log: string[] = [];
  const { handlers } = createInteractive({ style: {}, onKeyDown: () => log.push('key') });
  handlers.onKeyDown!(ke);
  expect(log).toEqual(['key']);
});

test('Box focusable prop sets Instance.focusable', () => {
  setFrameRequester(() => {});
  let box!: ReturnType<typeof Box>;
  const dispose = createRoot((d) => {
    box = Box({ focusable: true });
    return d;
  });
  expect(box.focusable).toBe(true);
  dispose();
  setFrameRequester(null);
});

test('Box without focusable leaves it undefined', () => {
  setFrameRequester(() => {});
  let box!: ReturnType<typeof Box>;
  const dispose = createRoot((d) => {
    box = Box({});
    return d;
  });
  expect(box.focusable).toBeUndefined();
  dispose();
  setFrameRequester(null);
});
```

- [ ] **Step 3: Run to verify FAIL**

Run: `pnpm vitest run packages/primitives/test/focus.test.ts`
Expected: FAIL — focus variant not activated / `Box` has no `focusable`.

- [ ] **Step 4: Add the `focused` signal to `createInteractive`** — in `packages/primitives/src/interactive.ts`:

Add a third signal and use it. Replace the signal block + `resolved` + handler additions:

After `const [pressed, setPressed] = createSignal(false);` add:

```ts
  const [focused, setFocused] = createSignal(false);
```

In `resolved`, add the focus state (after the `pressed` push):

```ts
    if (focused()) states.push('focus');
```

In the `handlers` object literal, add focus handlers (after `onPointerUp`):

```ts
    onFocus(e) {
      setFocused(true);
      props.onFocus?.(e);
    },
    onBlur(e) {
      setFocused(false);
      props.onBlur?.(e);
    },
```

After the existing pass-through block (`onClick`/`onPointerMove`/`onWheel`), add key pass-through:

```ts
  if (props.onKeyDown) handlers.onKeyDown = props.onKeyDown;
  if (props.onKeyUp) handlers.onKeyUp = props.onKeyUp;
```

- [ ] **Step 5: Add the `focusable` prop to the three primitives**

In `packages/primitives/src/box.ts`: add `focusable?: boolean;` to `BoxProps` (after `children?`), and add `focusable: props.focusable,` to the returned instance object (after `handlers,`).

In `packages/primitives/src/text.ts`: add `focusable?: boolean;` to `TextProps`, and `focusable: props.focusable,` to the returned instance (after `handlers,`).

In `packages/primitives/src/flex.ts`: add `focusable?: boolean;` to `FlexProps`, and `focusable: props.focusable,` to the returned instance in `flex(...)` (after `handlers,`).

- [ ] **Step 6: Verify green**

Run: `pnpm vitest run packages/primitives/test/focus.test.ts` → PASS (4).
Run: `pnpm vitest run packages/primitives` → existing primitives tests still PASS.
Run: `pnpm typecheck` → PASS.

- [ ] **Step 7: Commit**

```bash
git add packages/primitives/src/events.ts packages/primitives/src/interactive.ts packages/primitives/src/box.ts packages/primitives/src/text.ts packages/primitives/src/flex.ts packages/primitives/test/focus.test.ts
git commit -m "feat(primitives): focusable prop + focus state variant + key handlers"
```

---

## Task 7: platform-web — `WebInputSource` keyboard + example finale

**Files:**
- Modify: `packages/platform-web/src/web-input-source.ts`
- Modify: `examples/counter/main.tsx`
- Test: `packages/platform-web/test/web-input-source.test.ts`

- [ ] **Step 1: Add the failing test** — append to `packages/platform-web/test/web-input-source.test.ts`.

First, ensure the `fakeCanvas()` helper carries a `tabIndex`. If the helper's returned `canvas` object does not already have a `tabIndex` field, add `tabIndex: -1,` to it (it stores arbitrary listeners already, so no other change needed). Then append:

```ts
test('sets tabIndex so the canvas can receive keyboard focus', () => {
  const { canvas } = fakeCanvas();
  const c = canvas as unknown as { tabIndex: number };
  new WebInputSource(canvas);
  expect(c.tabIndex).toBe(0);
});

test('normalizes a keydown into KeyboardInput', () => {
  const { canvas, listeners } = fakeCanvas();
  const src = new WebInputSource(canvas);
  const seen: Array<Record<string, unknown>> = [];
  src.onKey((e) => seen.push({ type: e.type, key: e.key, code: e.code, shift: e.shift, ctrl: e.ctrl, alt: e.alt, meta: e.meta }));
  listeners.keydown({ key: 'Enter', code: 'Enter', shiftKey: false, ctrlKey: false, altKey: false, metaKey: false, preventDefault: () => {} });
  expect(seen).toEqual([{ type: 'keydown', key: 'Enter', code: 'Enter', shift: false, ctrl: false, alt: false, meta: false }]);
});

test('KeyboardInput.preventDefault forwards to the DOM event', () => {
  const { canvas, listeners } = fakeCanvas();
  const src = new WebInputSource(canvas);
  let prevented = false;
  src.onKey((e) => e.preventDefault());
  listeners.keydown({ key: 'Tab', code: 'Tab', shiftKey: false, ctrlKey: false, altKey: false, metaKey: false, preventDefault: () => { prevented = true; } });
  expect(prevented).toBe(true);
});

test('onKey unsubscribe stops delivery', () => {
  const { canvas, listeners } = fakeCanvas();
  const src = new WebInputSource(canvas);
  const seen: unknown[] = [];
  const off = src.onKey((e) => seen.push(e));
  off();
  listeners.keydown({ key: 'a', code: 'KeyA', shiftKey: false, ctrlKey: false, altKey: false, metaKey: false, preventDefault: () => {} });
  expect(seen).toEqual([]);
});
```

- [ ] **Step 2: Run to verify FAIL**

Run: `pnpm vitest run packages/platform-web/test/web-input-source.test.ts`
Expected: FAIL — no keydown listener / onKey is the no-op stub / tabIndex not set.

- [ ] **Step 3: Implement keyboard in `WebInputSource`** — in `packages/platform-web/src/web-input-source.ts`:

Add `KeyboardInput`, `KeyInputType` to the type import from `@cairn/host`.

Add a key subscriber Set next to the others:

```ts
  private keyCbs = new Set<(e: KeyboardInput) => void>();
```

In the constructor, after the existing listeners, set tabIndex and add keyboard listeners:

```ts
    if (canvas.tabIndex < 0) canvas.tabIndex = 0; // make the surface keyboard-focusable
    canvas.addEventListener('keydown', this.keydown);
    canvas.addEventListener('keyup', this.keyup);
```

Replace the temporary `onKey` stub (added in Task 1) with the real implementation:

```ts
  onKey(cb: (e: KeyboardInput) => void): () => void {
    this.keyCbs.add(cb);
    return () => this.keyCbs.delete(cb);
  }
```

In `dispose()`, add:

```ts
    this.canvas.removeEventListener('keydown', this.keydown);
    this.canvas.removeEventListener('keyup', this.keyup);
```

Add the emit + arrow fields (next to the pointer ones):

```ts
  private emitKey(type: KeyInputType, ev: KeyboardEvent): void {
    const input: KeyboardInput = {
      type,
      key: ev.key,
      code: ev.code,
      shift: ev.shiftKey,
      ctrl: ev.ctrlKey,
      alt: ev.altKey,
      meta: ev.metaKey,
      preventDefault: () => ev.preventDefault(),
    };
    for (const cb of this.keyCbs) cb(input);
  }

  private keydown = (ev: KeyboardEvent) => this.emitKey('keydown', ev);
  private keyup = (ev: KeyboardEvent) => this.emitKey('keyup', ev);
```

- [ ] **Step 4: Verify green**

Run: `pnpm vitest run packages/platform-web/test/web-input-source.test.ts` → PASS (all, incl. 4 new).
Run: `pnpm typecheck` → PASS.

- [ ] **Step 5: Make the counter button keyboard-operable** — in `examples/counter/main.tsx`, update the `Box` to be focusable with a focus variant and Enter/Space activation:

```tsx
      <Box
        focusable
        style={{
          backgroundColor: '#3b82f6',
          borderRadius: 16,
          padding: 24,
          hover: { backgroundColor: '#2563eb' },
          pressed: { backgroundColor: '#1d4ed8' },
          focus: { backgroundColor: '#1e40af' },
        }}
        onClick={() => setCount(count() + 1)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setCount(count() + 1);
          }
        }}
      >
```

- [ ] **Step 6: Full workspace green**

Run: `pnpm vitest run` → PASS (all).
Run: `pnpm typecheck` → PASS.

- [ ] **Step 7: Commit**

```bash
git add packages/platform-web/src/web-input-source.ts packages/platform-web/test/web-input-source.test.ts examples/counter/main.tsx
git commit -m "feat(platform-web): WebInputSource keyboard + keyboard-operable counter (M4 complete)"
```

---

## Exit Criteria

- Click-to-focus, Tab/Shift+Tab traversal, and key delivery to the focused element all work; `focus` variant activates live.
- `pnpm vitest run` + `pnpm typecheck` green across the workspace.
- Counter button operable by mouse AND keyboard (Tab, then Enter/Space) — manual browser check. **M4 complete.**

## Out of Scope (later)

- Numeric `tabIndex`, focus traps/scopes, auto-focus, `disabled` skipping focus.
- Text input / caret / IME (Phase 8); arrow-key roving; screen-reader focus (Phase 14).
