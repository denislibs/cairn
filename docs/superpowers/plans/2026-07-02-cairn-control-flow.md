# Cairn Phase 9 — Control Flow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dynamic children via `<Show>`, `<For>` (keyed), `<Index>`, `<Switch>`/`<Match>` — reactive control-flow that reconciles instances and disposes removed subtrees; plus a `FlexNode.mainAxisSize: 'min'` so lists shrink-wrap. Showcase: a todo app.

**Architecture:** Each control-flow component is a container Instance (its own layout node) whose children are maintained by a reconciling effect that mutates `instance.children` + the layout node's children and calls `scheduleFrame()`. Item/branch bodies are built inside `untrack(() => createRoot(...))` (isolated, disposable scopes). Lives in `@cairn/runtime`.

**Tech Stack:** TypeScript strict, pnpm, Vitest. Reactivity: `createEffect`/`createRoot`/`createMemo`/`createSignal`/`untrack`/`onCleanup`. Effects flush synchronously.

**Spec:** `docs/superpowers/specs/2026-07-02-cairn-control-flow-design.md`

**Critical discipline:** the reconciling effect tracks ONLY its data source (`each()`/`when()`); build children under `untrack`. Register the disposing `onCleanup` ONCE at construction, never inside the effect.

---

## Task 1: Layout — `FlexNode.mainAxisSize`

**Files:**
- Modify: `packages/layout/src/flex.ts`
- Test: `packages/layout/test/flex-main-axis-size.test.ts`

- [ ] **Step 1: Write the failing test** — `packages/layout/test/flex-main-axis-size.test.ts`:

```ts
import { test, expect } from 'vitest';
import { FlexNode, BoxNode } from '../src/index';
import type { LayoutContext } from '../src/index';

const ctx: LayoutContext = { measureText: (t) => ({ width: t.length * 7 }) };
const child = (w: number, h: number) => new BoxNode({ width: w, height: h });

test("default 'max' fills the main axis", () => {
  const col = new FlexNode({ direction: 'column', children: [child(20, 30)] });
  col.layout({ minW: 0, maxW: 100, minH: 0, maxH: 200 }, ctx);
  expect(col.size.h).toBe(200); // fills available height
});

test("'min' shrink-wraps the main axis to content", () => {
  const col = new FlexNode({ direction: 'column', mainAxisSize: 'min', gap: 10, children: [child(20, 30), child(20, 40)] });
  col.layout({ minW: 0, maxW: 100, minH: 0, maxH: 200 }, ctx);
  expect(col.size.h).toBe(80); // 30 + 10 gap + 40
});

test("'min' still respects minH", () => {
  const col = new FlexNode({ direction: 'column', mainAxisSize: 'min', children: [child(20, 30)] });
  col.layout({ minW: 0, maxW: 100, minH: 50, maxH: 200 }, ctx);
  expect(col.size.h).toBe(50); // clamped up to minH
});
```

- [ ] **Step 2: Run to verify FAIL**

Run: `pnpm vitest run packages/layout/test/flex-main-axis-size.test.ts`
Expected: FAIL — `mainAxisSize` not supported (default fills, `'min'` unrecognized).

- [ ] **Step 3: Add `mainAxisSize`** — in `packages/layout/src/flex.ts`:

Add to `FlexNodeProps` (after `align?`):
```ts
  mainAxisSize?: 'min' | 'max';
```
Add the field + constructor init to the class (after `align: Align;` / its assignment):
```ts
  mainAxisSize: 'min' | 'max';
```
and in the constructor (after `this.align = ...`):
```ts
    this.mainAxisSize = props.mainAxisSize ?? 'max';
```
Change the own-size computation. Replace:
```ts
    const ownMain = isFinite(mainMax) ? mainMax : contentMain;
```
with:
```ts
    const minMain = isRow ? c.minW : c.minH;
    const ownMain =
      this.mainAxisSize === 'min'
        ? clamp(contentMain, minMain, isFinite(mainMax) ? mainMax : contentMain)
        : isFinite(mainMax)
          ? mainMax
          : contentMain;
```

- [ ] **Step 4: Verify green**

Run: `pnpm vitest run packages/layout/test/flex-main-axis-size.test.ts` → 3 PASS.
Run: `pnpm vitest run packages/layout` → existing flex tests still PASS (default 'max' unchanged).
Run: `pnpm typecheck` → PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/layout/src/flex.ts packages/layout/test/flex-main-axis-size.test.ts
git commit -m "feat(layout): FlexNode.mainAxisSize ('min' shrink-wrap; default 'max')"
```

---

## Task 2: Runtime — `<Show>`

**Files:**
- Create: `packages/runtime/src/show.ts`
- Modify: `packages/runtime/src/index.ts`
- Test: `packages/runtime/test/show.test.ts`

- [ ] **Step 1: Write the failing test** — `packages/runtime/test/show.test.ts`:

```ts
import { test, expect } from 'vitest';
import { createRoot, createSignal, onCleanup } from '@cairn/reactivity';
import { BoxNode } from '@cairn/layout';
import { setFrameRequester, Show, type Instance } from '../src/index';

function leaf(tag: string): Instance {
  return { layout: new BoxNode({ width: 10, height: 10 }), children: [], paintSelf() {}, ...( { __tag: tag } as object) } as Instance;
}
const tagOf = (i: Instance | undefined) => (i as unknown as { __tag?: string })?.__tag;

test('Show renders children when truthy, fallback when falsy', () => {
  setFrameRequester(() => {});
  const [on, setOn] = createSignal(true);
  let s!: Instance;
  const dispose = createRoot((d) => {
    s = Show({ when: () => on(), children: () => leaf('yes'), fallback: () => leaf('no') });
    return d;
  });
  expect(tagOf(s.children[0])).toBe('yes');
  setOn(false);
  expect(tagOf(s.children[0])).toBe('no');
  setOn(true);
  expect(tagOf(s.children[0])).toBe('yes');
  dispose();
  setFrameRequester(null);
});

test('Show disposes the previous branch scope on toggle', () => {
  setFrameRequester(() => {});
  let disposed = 0;
  const [on, setOn] = createSignal(true);
  let s!: Instance;
  const dispose = createRoot((d) => {
    s = Show({
      when: () => on(),
      children: () => {
        onCleanup(() => (disposed += 1));
        return leaf('yes');
      },
    });
    return d;
  });
  expect(disposed).toBe(0);
  setOn(false);
  expect(disposed).toBe(1); // children scope cleaned up
  void s;
  dispose();
  setFrameRequester(null);
});
```

- [ ] **Step 2: Run to verify FAIL**

Run: `pnpm vitest run packages/runtime/test/show.test.ts`
Expected: FAIL — `Show` not exported.

- [ ] **Step 3: Implement** — `packages/runtime/src/show.ts`:

```ts
import { createEffect, createMemo, createRoot, onCleanup, untrack } from '@cairn/reactivity';
import { BoxNode } from '@cairn/layout';
import { type Instance } from './instance';
import { scheduleFrame } from './scheduler';

export interface ShowProps {
  when: () => unknown;
  children: () => Instance;
  fallback?: () => Instance;
}

// Single-slot container. Swaps between children and fallback when when()'s truthiness flips,
// disposing the previous branch's reactive scope.
export function Show(props: ShowProps): Instance {
  const layout = new BoxNode({});
  const instance: Instance = { layout, children: [], paintSelf() {} };
  let scope: (() => void) | null = null;

  const setChild = (child: Instance | null): void => {
    instance.children = child ? [child] : [];
    layout.children = child ? [child.layout] : [];
    scheduleFrame();
  };

  const cond = createMemo(() => !!props.when());
  createEffect(() => {
    const show = cond();
    if (scope) {
      scope();
      scope = null;
    }
    const build = show ? props.children : props.fallback;
    let child: Instance | null = null;
    if (build) {
      untrack(() =>
        createRoot((d) => {
          child = build();
          scope = d;
        }),
      );
    }
    setChild(child);
  });

  onCleanup(() => {
    if (scope) scope();
  });

  return instance;
}
```

- [ ] **Step 4: Export** — in `packages/runtime/src/index.ts`, add:

```ts
export { Show } from './show';
export type { ShowProps } from './show';
```

- [ ] **Step 5: Verify green**

Run: `pnpm vitest run packages/runtime/test/show.test.ts` → 2 PASS.
Run: `pnpm vitest run packages/runtime` → existing tests still PASS.
Run: `pnpm typecheck` → PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/runtime/src/show.ts packages/runtime/src/index.ts packages/runtime/test/show.test.ts
git commit -m "feat(runtime): Show control-flow (conditional single slot)"
```

---

## Task 3: Runtime — `<For>` (keyed)

**Files:**
- Create: `packages/runtime/src/for.ts`
- Modify: `packages/runtime/src/index.ts`
- Test: `packages/runtime/test/for.test.ts`

- [ ] **Step 1: Write the failing test** — `packages/runtime/test/for.test.ts`:

```ts
import { test, expect } from 'vitest';
import { createRoot, createSignal, onCleanup } from '@cairn/reactivity';
import { BoxNode, FlexNode } from '@cairn/layout';
import { setFrameRequester, For, type Instance } from '../src/index';

function leaf(tag: string): Instance {
  return { layout: new BoxNode({ width: 10, height: 10 }), children: [], paintSelf() {}, ...( { __tag: tag } as object) } as Instance;
}
const tags = (i: Instance) => i.children.map((c) => (c as unknown as { __tag?: string }).__tag);

test('For maps items in order and reconciles by key (reuse + reorder + add + remove)', () => {
  setFrameRequester(() => {});
  const [items, setItems] = createSignal([{ id: 1 }, { id: 2 }]);
  let f!: Instance;
  const dispose = createRoot((d) => {
    f = For({ each: () => items(), key: (t) => t.id, children: (t) => leaf('n' + t.id) });
    return d;
  });
  expect(tags(f)).toEqual(['n1', 'n2']);
  const first = f.children[0]; // key 1 instance
  setItems([{ id: 2 }, { id: 1 }, { id: 3 }]); // reorder + add
  expect(tags(f)).toEqual(['n2', 'n1', 'n3']);
  expect(f.children[1]).toBe(first); // key 1 reused (same instance)
  expect((f.layout as FlexNode).children.map((c) => c)).toEqual(f.children.map((c) => c.layout)); // layout order mirrors
  setItems([{ id: 1 }]); // remove 2 and 3
  expect(tags(f)).toEqual(['n1']);
  dispose();
  setFrameRequester(null);
});

test('For disposes removed item scopes', () => {
  setFrameRequester(() => {});
  let disposed = 0;
  const [items, setItems] = createSignal([{ id: 1 }, { id: 2 }]);
  let f!: Instance;
  const dispose = createRoot((d) => {
    f = For({
      each: () => items(),
      key: (t) => t.id,
      children: (t) => {
        onCleanup(() => (disposed += 1));
        return leaf('n' + t.id);
      },
    });
    return d;
  });
  setItems([{ id: 1 }]); // drop id 2
  expect(disposed).toBe(1);
  void f;
  dispose();
  expect(disposed).toBe(2); // remaining disposed on unmount
  setFrameRequester(null);
});

test('For shows fallback when empty', () => {
  setFrameRequester(() => {});
  const [items, setItems] = createSignal<{ id: number }[]>([]);
  let f!: Instance;
  const dispose = createRoot((d) => {
    f = For({ each: () => items(), key: (t) => t.id, children: (t) => leaf('n' + t.id), fallback: () => leaf('empty') });
    return d;
  });
  expect(tags(f)).toEqual(['empty']);
  setItems([{ id: 1 }]);
  expect(tags(f)).toEqual(['n1']);
  dispose();
  setFrameRequester(null);
});
```

- [ ] **Step 2: Run to verify FAIL**

Run: `pnpm vitest run packages/runtime/test/for.test.ts`
Expected: FAIL — `For` not exported.

- [ ] **Step 3: Implement** — `packages/runtime/src/for.ts`:

```ts
import { createEffect, createRoot, onCleanup, untrack } from '@cairn/reactivity';
import { FlexNode, type FlexDirection } from '@cairn/layout';
import { type Instance } from './instance';
import { scheduleFrame } from './scheduler';

export interface ForProps<T> {
  each: () => T[];
  children: (item: T, index: number) => Instance;
  key?: (item: T, index: number) => unknown;
  fallback?: () => Instance;
  direction?: FlexDirection;
  gap?: number;
}

interface Entry {
  instance: Instance;
  dispose: () => void;
}

// Keyed list: reuses instances for surviving keys, disposes removed keys' scopes, reorders.
export function For<T>(props: ForProps<T>): Instance {
  const layout = new FlexNode({
    direction: props.direction ?? 'column',
    gap: props.gap ?? 0,
    mainAxisSize: 'min',
  });
  const instance: Instance = { layout, children: [], paintSelf() {} };
  const keyOf = props.key ?? ((item: T) => item as unknown);

  let entries = new Map<unknown, Entry>();
  let fallback: Entry | null = null;

  const apply = (children: Instance[]): void => {
    instance.children = children;
    layout.children = children.map((c) => c.layout);
    scheduleFrame();
  };

  const disposeFallback = (): void => {
    if (fallback) {
      fallback.dispose();
      fallback = null;
    }
  };

  createEffect(() => {
    const items = props.each();

    if (items.length === 0) {
      for (const e of entries.values()) e.dispose();
      entries = new Map();
      if (props.fallback) {
        if (!fallback) {
          untrack(() =>
            createRoot((d) => {
              fallback = { instance: props.fallback!(), dispose: d };
            }),
          );
        }
        apply([fallback!.instance]);
      } else {
        apply([]);
      }
      return;
    }

    disposeFallback();
    const next = new Map<unknown, Entry>();
    const ordered: Instance[] = [];
    items.forEach((item, i) => {
      const k = keyOf(item, i);
      let entry = entries.get(k);
      if (entry) {
        entries.delete(k); // consume so leftovers can be disposed
      } else {
        untrack(() =>
          createRoot((d) => {
            entry = { instance: props.children(item, i), dispose: d };
          }),
        );
      }
      next.set(k, entry!);
      ordered.push(entry!.instance);
    });
    for (const e of entries.values()) e.dispose(); // removed keys
    entries = next;
    apply(ordered);
  });

  onCleanup(() => {
    for (const e of entries.values()) e.dispose();
    disposeFallback();
  });

  return instance;
}
```

- [ ] **Step 4: Export** — in `packages/runtime/src/index.ts`, add:

```ts
export { For } from './for';
export type { ForProps } from './for';
```

- [ ] **Step 5: Verify green**

Run: `pnpm vitest run packages/runtime/test/for.test.ts` → 3 PASS.
Run: `pnpm vitest run packages/runtime` → existing tests still PASS.
Run: `pnpm typecheck` → PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/runtime/src/for.ts packages/runtime/src/index.ts packages/runtime/test/for.test.ts
git commit -m "feat(runtime): For control-flow (keyed reconciliation + subtree cleanup)"
```

---

## Task 4: Runtime — `<Index>`

**Files:**
- Create: `packages/runtime/src/index-cf.ts`
- Modify: `packages/runtime/src/index.ts`
- Test: `packages/runtime/test/index-cf.test.ts`

- [ ] **Step 1: Write the failing test** — `packages/runtime/test/index-cf.test.ts`:

```ts
import { test, expect } from 'vitest';
import { createRoot, createSignal } from '@cairn/reactivity';
import { BoxNode } from '@cairn/layout';
import { setFrameRequester, Index, bind, type Instance } from '../src/index';

// A leaf whose __tag reactively follows its item accessor.
function leaf(item: () => string): Instance {
  const inst = { layout: new BoxNode({ width: 10, height: 10 }), children: [], paintSelf() {}, __tag: '' } as unknown as {
    layout: BoxNode;
    children: Instance[];
    paintSelf(): void;
    __tag: string;
  };
  bind(item, (v) => (inst.__tag = v));
  return inst as unknown as Instance;
}
const tags = (i: Instance) => i.children.map((c) => (c as unknown as { __tag: string }).__tag);

test('Index updates values in place (same instance) and grows/shrinks', () => {
  setFrameRequester(() => {});
  const [rows, setRows] = createSignal(['a', 'b']);
  let idx!: Instance;
  const dispose = createRoot((d) => {
    idx = Index({ each: () => rows(), children: (item) => leaf(item) });
    return d;
  });
  expect(tags(idx)).toEqual(['a', 'b']);
  const first = idx.children[0];
  setRows(['x', 'b']); // value change at index 0
  expect(tags(idx)).toEqual(['x', 'b']);
  expect(idx.children[0]).toBe(first); // same instance, updated value
  setRows(['x', 'b', 'c']); // grow
  expect(tags(idx)).toEqual(['x', 'b', 'c']);
  setRows(['x']); // shrink
  expect(tags(idx)).toEqual(['x']);
  dispose();
  setFrameRequester(null);
});
```

- [ ] **Step 2: Run to verify FAIL**

Run: `pnpm vitest run packages/runtime/test/index-cf.test.ts`
Expected: FAIL — `Index` not exported.

- [ ] **Step 3: Implement** — `packages/runtime/src/index-cf.ts`:

```ts
import { createEffect, createRoot, createSignal, onCleanup, untrack } from '@cairn/reactivity';
import { FlexNode, type FlexDirection } from '@cairn/layout';
import { type Instance } from './instance';
import { scheduleFrame } from './scheduler';

export interface IndexProps<T> {
  each: () => T[];
  children: (item: () => T, index: number) => Instance;
  fallback?: () => Instance;
  direction?: FlexDirection;
  gap?: number;
}

interface Slot<T> {
  setItem: (v: T) => void;
  instance: Instance;
  dispose: () => void;
}

// Index-keyed list: slots are reused by position; only the item accessor changes.
export function Index<T>(props: IndexProps<T>): Instance {
  const layout = new FlexNode({
    direction: props.direction ?? 'column',
    gap: props.gap ?? 0,
    mainAxisSize: 'min',
  });
  const instance: Instance = { layout, children: [], paintSelf() {} };
  const slots: Slot<T>[] = [];
  let fallback: { instance: Instance; dispose: () => void } | null = null;

  const apply = (children: Instance[]): void => {
    instance.children = children;
    layout.children = children.map((c) => c.layout);
    scheduleFrame();
  };

  createEffect(() => {
    const items = props.each();

    // Update overlapping slots in place.
    const overlap = Math.min(items.length, slots.length);
    for (let i = 0; i < overlap; i++) slots[i].setItem(items[i]);

    let lengthChanged = false;
    if (items.length > slots.length) {
      for (let i = slots.length; i < items.length; i++) {
        const start = items[i];
        untrack(() =>
          createRoot((d) => {
            const [item, setItem] = createSignal<T>(start);
            const inst = props.children(item, i);
            slots.push({ setItem, instance: inst, dispose: d });
          }),
        );
      }
      lengthChanged = true;
    } else if (items.length < slots.length) {
      const removed = slots.splice(items.length);
      for (const s of removed) s.dispose();
      lengthChanged = true;
    }

    if (items.length === 0 && props.fallback) {
      if (!fallback) {
        untrack(() =>
          createRoot((d) => {
            fallback = { instance: props.fallback!(), dispose: d };
          }),
        );
      }
      apply([fallback!.instance]);
      return;
    }
    if (fallback) {
      fallback.dispose();
      fallback = null;
      lengthChanged = true;
    }
    if (lengthChanged) apply(slots.map((s) => s.instance));
  });

  onCleanup(() => {
    for (const s of slots) s.dispose();
    if (fallback) fallback.dispose();
  });

  return instance;
}
```

- [ ] **Step 4: Export** — in `packages/runtime/src/index.ts`, add:

```ts
export { Index } from './index-cf';
export type { IndexProps } from './index-cf';
```

- [ ] **Step 5: Verify green**

Run: `pnpm vitest run packages/runtime/test/index-cf.test.ts` → 1 PASS.
Run: `pnpm vitest run packages/runtime` → existing tests still PASS.
Run: `pnpm typecheck` → PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/runtime/src/index-cf.ts packages/runtime/src/index.ts packages/runtime/test/index-cf.test.ts
git commit -m "feat(runtime): Index control-flow (index-keyed, in-place value updates)"
```

---

## Task 5: Runtime — `<Switch>` / `<Match>`

**Files:**
- Create: `packages/runtime/src/switch.ts`
- Modify: `packages/runtime/src/index.ts`
- Test: `packages/runtime/test/switch.test.ts`

- [ ] **Step 1: Write the failing test** — `packages/runtime/test/switch.test.ts`:

```ts
import { test, expect } from 'vitest';
import { createRoot, createSignal } from '@cairn/reactivity';
import { BoxNode } from '@cairn/layout';
import { setFrameRequester, Switch, Match, type Instance } from '../src/index';

function leaf(tag: string): Instance {
  return { layout: new BoxNode({ width: 10, height: 10 }), children: [], paintSelf() {}, ...( { __tag: tag } as object) } as Instance;
}
const tag = (i: Instance) => (i.children[0] as unknown as { __tag?: string })?.__tag;

test('Switch renders the first matching Match; fallback when none', () => {
  setFrameRequester(() => {});
  const [a, setA] = createSignal(false);
  const [b, setB] = createSignal(false);
  let sw!: Instance;
  const dispose = createRoot((d) => {
    sw = Switch({
      fallback: () => leaf('none'),
      children: [
        Match({ when: () => a(), children: () => leaf('A') }),
        Match({ when: () => b(), children: () => leaf('B') }),
      ],
    });
    return d;
  });
  expect(tag(sw)).toBe('none');
  setB(true);
  expect(tag(sw)).toBe('B');
  setA(true);
  expect(tag(sw)).toBe('A'); // first match wins
  dispose();
  setFrameRequester(null);
});
```

- [ ] **Step 2: Run to verify FAIL**

Run: `pnpm vitest run packages/runtime/test/switch.test.ts`
Expected: FAIL — `Switch`/`Match` not exported.

- [ ] **Step 3: Implement** — `packages/runtime/src/switch.ts`:

```ts
import { createEffect, createMemo, createRoot, onCleanup, untrack } from '@cairn/reactivity';
import { BoxNode } from '@cairn/layout';
import { type Instance } from './instance';
import { scheduleFrame } from './scheduler';

export interface MatchDescriptor {
  when: () => unknown;
  children: () => Instance;
}

export type MatchProps = MatchDescriptor;

// Match is a descriptor consumed by Switch — not an Instance itself.
export function Match(props: MatchProps): MatchDescriptor {
  return { when: props.when, children: props.children };
}

export interface SwitchProps {
  children: MatchDescriptor | MatchDescriptor[];
  fallback?: () => Instance;
}

// Renders the first Match whose when() is truthy; fallback when none match.
export function Switch(props: SwitchProps): Instance {
  const matches = Array.isArray(props.children) ? props.children : [props.children];
  const layout = new BoxNode({});
  const instance: Instance = { layout, children: [], paintSelf() {} };
  let scope: (() => void) | null = null;

  const chosen = createMemo(() => {
    for (let i = 0; i < matches.length; i++) {
      if (matches[i].when()) return i;
    }
    return -1;
  });

  createEffect(() => {
    const idx = chosen();
    if (scope) {
      scope();
      scope = null;
    }
    const build = idx >= 0 ? matches[idx].children : props.fallback;
    let child: Instance | null = null;
    if (build) {
      untrack(() =>
        createRoot((d) => {
          child = build();
          scope = d;
        }),
      );
    }
    instance.children = child ? [child] : [];
    layout.children = child ? [child.layout] : [];
    scheduleFrame();
  });

  onCleanup(() => {
    if (scope) scope();
  });

  return instance;
}
```

- [ ] **Step 4: Export** — in `packages/runtime/src/index.ts`, add:

```ts
export { Switch, Match } from './switch';
export type { SwitchProps, MatchProps, MatchDescriptor } from './switch';
```

- [ ] **Step 5: Verify green**

Run: `pnpm vitest run packages/runtime/test/switch.test.ts` → 1 PASS.
Run: `pnpm vitest run packages/runtime` → existing tests still PASS.
Run: `pnpm typecheck` → PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/runtime/src/switch.ts packages/runtime/src/index.ts packages/runtime/test/switch.test.ts
git commit -m "feat(runtime): Switch/Match control-flow"
```

---

## Task 6: Showcase — todo app + full green

**Files:**
- Create: `examples/todo/index.html`
- Create: `examples/todo/vite.config.ts`
- Create: `examples/todo/main.tsx`
- (No new unit tests; workspace must stay green.)

- [ ] **Step 1: `examples/todo/index.html`** (dark theme):

```html
<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Cairn — todo</title>
    <style>
      html, body { margin: 0; height: 100%; background: #0d0d0d; }
      #stage { display: block; width: 100vw; height: 100vh; }
    </style>
  </head>
  <body>
    <canvas id="stage"></canvas>
    <script type="module" src="./main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 2: `examples/todo/vite.config.ts`** (copy the counter's alias config):

```ts
import { defineConfig } from 'vite';
import { fileURLToPath, URL } from 'node:url';

const pkg = (p: string) => fileURLToPath(new URL(`../../packages/${p}`, import.meta.url));

export default defineConfig({
  esbuild: {
    jsx: 'automatic',
    jsxImportSource: '@cairn/runtime',
    jsxDev: false,
  },
  resolve: {
    alias: {
      '@cairn/runtime/jsx-runtime': pkg('runtime/src/jsx-runtime.ts'),
      '@cairn/reactivity': pkg('reactivity/src/index.ts'),
      '@cairn/host': pkg('host/src/index.ts'),
      '@cairn/layout': pkg('layout/src/index.ts'),
      '@cairn/runtime': pkg('runtime/src/index.ts'),
      '@cairn/primitives': pkg('primitives/src/index.ts'),
      '@cairn/style': pkg('style/src/index.ts'),
      '@cairn/events': pkg('events/src/index.ts'),
      '@cairn/platform-web': pkg('platform-web/src/index.ts'),
    },
  },
});
```

- [ ] **Step 3: `examples/todo/main.tsx`** — a todo app exercising For/Show/Input/events:

```tsx
import { createSignal } from '@cairn/reactivity';
import { createWebHost } from '@cairn/platform-web';
import { mount, For, Show } from '@cairn/runtime';
import { Box, Column, Row, Text, Input } from '@cairn/primitives';

const canvas = document.getElementById('stage') as HTMLCanvasElement;
const host = createWebHost(canvas);

interface Todo {
  id: number;
  text: string;
  done: boolean;
}

const [todos, setTodos] = createSignal<Todo[]>([]);
const [draft, setDraft] = createSignal('');
let nextId = 1;

function addTodo(): void {
  const text = draft().trim();
  if (!text) return;
  setTodos([...todos(), { id: nextId++, text, done: false }]);
  setDraft('');
}

function toggle(id: number): void {
  setTodos(todos().map((t) => (t.id === id ? { ...t, done: !t.done } : t)));
}

function remove(id: number): void {
  setTodos(todos().filter((t) => t.id !== id));
}

const activeCount = (): number => todos().filter((t) => !t.done).length;

// Keyed <For> reuses a row instance across data changes, so the row must read its
// todo REACTIVELY by id (not capture the plain value) — otherwise a `done` toggle
// wouldn't show. `done` is shown via a reactive text prefix (Text content is
// reactive; style color is not).
function TodoRow(id: number) {
  const todo = () => todos().find((t) => t.id === id);
  return (
    <Row style={{ gap: 10, align: 'center' }}>
      <Box
        style={{ width: 300, backgroundColor: '#1e1e20', borderRadius: 10, padding: 12, hover: { backgroundColor: '#26262a' } }}
        onClick={() => toggle(id)}
      >
        <Text style={{ font: '16px sans-serif', color: '#e5e7eb' }}>
          {() => {
            const t = todo();
            return t ? (t.done ? '✓ ' : '') + t.text : '';
          }}
        </Text>
      </Box>
      <Box
        style={{ width: 44, height: 44, backgroundColor: '#2a1416', borderRadius: 10, hover: { backgroundColor: '#3a191c' } }}
        onClick={() => remove(id)}
      >
        <Column style={{ justify: 'center', align: 'center' }}>
          <Row style={{ justify: 'center', align: 'center' }}>
            <Text style={{ font: '18px sans-serif', color: '#f87171' }}>✕</Text>
          </Row>
        </Column>
      </Box>
    </Row>
  );
}

function App() {
  return (
    <Column style={{ justify: 'center', align: 'center' }}>
      <Box style={{ width: 460, padding: 28, backgroundColor: '#1b1b1d', borderRadius: 24 }}>
        <Column style={{ gap: 16, align: 'center' }}>
          <Text style={{ font: 'bold 26px sans-serif', color: '#ffffff' }}>Задачи</Text>
          <Input
            value={draft}
            onInput={setDraft}
            onSubmit={addTodo}
            placeholder="Новая задача — Enter"
            style={{ width: 404, backgroundColor: '#0f0f10', color: '#f3f4f6', borderRadius: 10, padding: 12, font: '16px sans-serif', focus: { backgroundColor: '#141416' } }}
          />
          <Show when={() => todos().length > 0} fallback={() => <Text style={{ font: '15px sans-serif', color: '#6b7280' }}>Пока пусто — добавь первую</Text>}>
            {() => <For each={() => todos()} key={(t) => t.id} gap={8}>{(item) => TodoRow(item.id)}</For>}
          </Show>
          <Text style={{ font: '14px sans-serif', color: '#9ca3af' }}>{() => `Осталось: ${activeCount()}`}</Text>
        </Column>
      </Box>
    </Column>
  );
}

mount(App, host);
```

- [ ] **Step 4: Full workspace green**

Run: `pnpm vitest run` → PASS (all).
Run: `pnpm typecheck` → PASS.

- [ ] **Step 5: Commit**

```bash
git add examples/todo/index.html examples/todo/vite.config.ts examples/todo/main.tsx
git commit -m "example(todo): For/Show/Input todo app (Phase 9 showcase)"
```

---

## Exit Criteria

- `<Show>`/`<For>`/`<Index>`/`<Switch>`/`<Match>` work with keyed reconciliation + subtree cleanup; `FlexNode.mainAxisSize:'min'` shrink-wraps.
- `pnpm vitest run` + `pnpm typecheck` green across the workspace.
- `examples/todo` runs: add, toggle (strikethrough color), delete, empty-state, live count (manual browser check).

## Out of Scope

- `<Portal>` / overlays; transparent fragment-flattening; animated list transitions (Phase 13).
