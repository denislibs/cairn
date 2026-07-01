# @cairn/reactivity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build Cairn's from-scratch fine-grained reactivity core (`@cairn/reactivity`): `createSignal`, `createEffect`, `createMemo`, `createRoot`, `onCleanup`, `batch`, `untrack` — with automatic dependency tracking, an owner tree for disposal, and glitch-free (diamond-safe) updates.

**Architecture:** A synchronous, push-then-pull reactive graph in the style of SolidJS / the `reactively` algorithm. Nodes have three states — `CLEAN` / `CHECK` / `STALE`. Writing a signal marks direct observers `STALE` and transitive observers `CHECK`, then schedules effects. Effects are drained through a queue (giving automatic batching); memos are lazy and pulled on read via `updateIfNecessary`, which only recomputes when an upstream memo actually changed value. An owner tree tracks ownership so `createRoot`/effect re-runs dispose nested computations and run cleanups. **No DOM APIs** — this package is fully platform-agnostic.

**Tech Stack:** TypeScript (strict), pnpm workspaces, Vitest. Node ESM. No runtime dependencies.

---

## File Structure

```
pnpm-workspace.yaml                         # workspace globs
package.json                                # root: scripts + devDeps (typescript, vitest)
tsconfig.base.json                          # shared TS compiler options
vitest.config.ts                            # test include globs
packages/reactivity/
  package.json                              # @cairn/reactivity manifest
  tsconfig.json                             # extends base
  src/
    core.ts                                 # the reactive engine: nodes, tracking, scheduler,
                                            #   owner tree, createRoot/onCleanup/batch/untrack
    signal.ts                               # createSignal (thin wrapper over core)
    memo.ts                                 # createMemo (thin wrapper over core)
    effect.ts                               # createEffect (thin wrapper over core)
    index.ts                                # public barrel exports
  test/
    signal.test.ts
    ownership.test.ts
    effect.test.ts
    batch.test.ts
    untrack.test.ts
    memo.test.ts
    glitch-free.test.ts
    equals.test.ts
    disposal.test.ts
```

**Responsibilities:**
- `core.ts` is the cohesive engine. The reactive graph is tightly coupled (tracking, scheduling, ownership all touch shared globals), so it lives in one focused module rather than being split across files that would need circular imports.
- `signal.ts` / `memo.ts` / `effect.ts` are thin public wrappers importing only from `core.ts` (one-directional, no cycles).
- `index.ts` re-exports the public surface.

---

## Task 1: Workspace + package scaffolding

**Files:**
- Create: `pnpm-workspace.yaml`
- Create: `package.json`
- Create: `tsconfig.base.json`
- Create: `vitest.config.ts`
- Create: `packages/reactivity/package.json`
- Create: `packages/reactivity/tsconfig.json`
- Create: `packages/reactivity/src/index.ts`
- Test: `packages/reactivity/test/smoke.test.ts`

- [ ] **Step 1: Write the failing test**

`packages/reactivity/test/smoke.test.ts`:
```ts
import { test, expect } from 'vitest';
import { VERSION } from '../src/index';

test('package is importable', () => {
  expect(VERSION).toBe('0.0.0');
});
```

- [ ] **Step 2: Create the workspace + config files**

`pnpm-workspace.yaml`:
```yaml
packages:
  - 'packages/*'
```

`package.json`:
```json
{
  "name": "cairn",
  "private": true,
  "type": "module",
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "typecheck": "tsc -b"
  },
  "devDependencies": {
    "typescript": "^5.5.0",
    "vitest": "^2.0.0"
  }
}
```

`tsconfig.base.json`:
```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "declaration": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "noUncheckedIndexedAccess": false
  }
}
```

`vitest.config.ts`:
```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['packages/**/test/**/*.test.ts'],
  },
});
```

`packages/reactivity/package.json`:
```json
{
  "name": "@cairn/reactivity",
  "version": "0.0.0",
  "type": "module",
  "main": "./src/index.ts",
  "module": "./src/index.ts",
  "types": "./src/index.ts",
  "exports": {
    ".": "./src/index.ts"
  },
  "sideEffects": false
}
```

`packages/reactivity/tsconfig.json`:
```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src", "test"]
}
```

`packages/reactivity/src/index.ts`:
```ts
export const VERSION = '0.0.0';
```

- [ ] **Step 3: Install dependencies**

Run: `pnpm install`
Expected: creates `node_modules` and `pnpm-lock.yaml`, no errors.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run packages/reactivity/test/smoke.test.ts`
Expected: PASS (1 test).

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "chore: scaffold pnpm workspace and @cairn/reactivity package"
```

---

## Task 2: createSignal (read/write, no reactivity yet)

We start with a signal that just stores and returns a value, plus setter-function form. Reactivity is layered on in Task 4.

**Files:**
- Create: `packages/reactivity/src/core.ts`
- Create: `packages/reactivity/src/signal.ts`
- Modify: `packages/reactivity/src/index.ts`
- Test: `packages/reactivity/test/signal.test.ts`

- [ ] **Step 1: Write the failing test**

`packages/reactivity/test/signal.test.ts`:
```ts
import { test, expect } from 'vitest';
import { createSignal } from '../src/index';

test('returns the initial value', () => {
  const [count] = createSignal(5);
  expect(count()).toBe(5);
});

test('setter updates the value', () => {
  const [count, setCount] = createSignal(0);
  setCount(10);
  expect(count()).toBe(10);
});

test('setter accepts an updater function', () => {
  const [count, setCount] = createSignal(1);
  setCount((prev) => prev + 1);
  expect(count()).toBe(2);
});

test('setter returns the new value', () => {
  const [, setCount] = createSignal(0);
  expect(setCount(7)).toBe(7);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run packages/reactivity/test/signal.test.ts`
Expected: FAIL — `createSignal` is not exported.

- [ ] **Step 3: Create the minimal core + signal**

`packages/reactivity/src/core.ts`:
```ts
// Fine-grained reactive engine. No DOM APIs — platform-agnostic.

export type EqualsFn<T> = (prev: T, next: T) => boolean;
export const defaultEquals = <T>(a: T, b: T): boolean => a === b;

export interface SignalState<T> {
  value: T;
  observers: Computation<any>[] | null;
  equals: EqualsFn<T> | false;
}

// Placeholder — fleshed out in Task 4.
export interface Computation<T> {
  value: T;
}

export function readSource<T>(node: SignalState<T>): T {
  return node.value;
}

export function writeSignal<T>(node: SignalState<T>, value: T): T {
  if (node.equals === false || !node.equals(node.value, value)) {
    node.value = value;
  }
  return value;
}
```

`packages/reactivity/src/signal.ts`:
```ts
import {
  type SignalState,
  type EqualsFn,
  readSource,
  writeSignal,
  defaultEquals,
} from './core';

export type Accessor<T> = () => T;
export type Setter<T> = (value: T | ((prev: T) => T)) => T;

export interface SignalOptions<T> {
  equals?: EqualsFn<T> | false;
}

export function createSignal<T>(
  value: T,
  options?: SignalOptions<T>,
): [Accessor<T>, Setter<T>] {
  const node: SignalState<T> = {
    value,
    observers: null,
    equals: options?.equals ?? defaultEquals,
  };
  const read: Accessor<T> = () => readSource(node);
  const write: Setter<T> = (next) =>
    writeSignal(
      node,
      typeof next === 'function' ? (next as (prev: T) => T)(node.value) : next,
    );
  return [read, write];
}
```

`packages/reactivity/src/index.ts`:
```ts
export const VERSION = '0.0.0';

export { createSignal } from './signal';
export type { Accessor, Setter, SignalOptions } from './signal';
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run packages/reactivity/test/signal.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(reactivity): createSignal read/write with updater form"
```

---

## Task 3: Owner tree — createRoot + onCleanup

The owner tree tracks ownership so computations and cleanups can be disposed. This is standalone-testable before effects exist.

**Files:**
- Modify: `packages/reactivity/src/core.ts`
- Modify: `packages/reactivity/src/index.ts`
- Test: `packages/reactivity/test/ownership.test.ts`

- [ ] **Step 1: Write the failing test**

`packages/reactivity/test/ownership.test.ts`:
```ts
import { test, expect, vi } from 'vitest';
import { createRoot, onCleanup } from '../src/index';

test('createRoot runs its function and returns the result', () => {
  const result = createRoot(() => 42);
  expect(result).toBe(42);
});

test('createRoot passes a dispose function', () => {
  createRoot((dispose) => {
    expect(typeof dispose).toBe('function');
  });
});

test('onCleanup callbacks run when the root is disposed', () => {
  const cleanup = vi.fn();
  createRoot((dispose) => {
    onCleanup(cleanup);
    expect(cleanup).not.toHaveBeenCalled();
    dispose();
    expect(cleanup).toHaveBeenCalledTimes(1);
  });
});

test('onCleanup outside any owner is a no-op (does not throw)', () => {
  expect(() => onCleanup(() => {})).not.toThrow();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run packages/reactivity/test/ownership.test.ts`
Expected: FAIL — `createRoot` / `onCleanup` not exported.

- [ ] **Step 3: Replace core.ts with the owner-tree version**

`packages/reactivity/src/core.ts` (full file):
```ts
// Fine-grained reactive engine. No DOM APIs — platform-agnostic.

export type EqualsFn<T> = (prev: T, next: T) => boolean;
export const defaultEquals = <T>(a: T, b: T): boolean => a === b;

export interface SignalState<T> {
  value: T;
  observers: Computation<any>[] | null;
  equals: EqualsFn<T> | false;
}

export interface Owner {
  owned: Computation<any>[] | null;
  cleanups: (() => void)[] | null;
  owner: Owner | null;
}

// Placeholder — fleshed out in Task 4.
export interface Computation<T> extends Owner {
  value: T;
}

// ---- globals ----
let currentOwner: Owner | null = null;

export function getOwner(): Owner | null {
  return currentOwner;
}

export function setOwner(owner: Owner | null): Owner | null {
  const prev = currentOwner;
  currentOwner = owner;
  return prev;
}

// ---- signal read/write (no observers wired yet — Task 4) ----
export function readSource<T>(node: SignalState<T>): T {
  return node.value;
}

export function writeSignal<T>(node: SignalState<T>, value: T): T {
  if (node.equals === false || !node.equals(node.value, value)) {
    node.value = value;
  }
  return value;
}

// ---- ownership ----
export function createRoot<T>(fn: (dispose: () => void) => T): T {
  const root: Owner = { owned: null, cleanups: null, owner: currentOwner };
  const prevOwner = currentOwner;
  currentOwner = root;
  try {
    return fn(() => disposeOwner(root));
  } finally {
    currentOwner = prevOwner;
  }
}

export function onCleanup(fn: () => void): () => void {
  if (currentOwner) {
    (currentOwner.cleanups || (currentOwner.cleanups = [])).push(fn);
  }
  return fn;
}

function disposeOwner(owner: Owner): void {
  if (owner.owned) {
    for (let i = 0; i < owner.owned.length; i++) disposeNode(owner.owned[i]);
    owner.owned = null;
  }
  if (owner.cleanups) {
    for (let i = 0; i < owner.cleanups.length; i++) owner.cleanups[i]();
    owner.cleanups = null;
  }
}

// Full implementation arrives in Task 4; here it only needs to recurse cleanups.
function disposeNode(node: Computation<any>): void {
  disposeOwner(node);
}
```

`packages/reactivity/src/index.ts`:
```ts
export const VERSION = '0.0.0';

export { createSignal } from './signal';
export type { Accessor, Setter, SignalOptions } from './signal';

export { createRoot, onCleanup, getOwner } from './core';
export type { Owner } from './core';
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run packages/reactivity/test/ownership.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(reactivity): owner tree with createRoot and onCleanup"
```

---

## Task 4: The reactive engine — createEffect with tracking

This is the heart of the system. It introduces node states, automatic dependency tracking, the effect scheduler (which gives batching for free within a single write), dynamic dependency re-collection, and cleanup-on-rerun. It replaces `core.ts` with the full engine.

**Files:**
- Modify: `packages/reactivity/src/core.ts` (full replacement)
- Create: `packages/reactivity/src/effect.ts`
- Modify: `packages/reactivity/src/index.ts`
- Test: `packages/reactivity/test/effect.test.ts`

- [ ] **Step 1: Write the failing test**

`packages/reactivity/test/effect.test.ts`:
```ts
import { test, expect, vi } from 'vitest';
import { createSignal, createEffect, createRoot, onCleanup } from '../src/index';

test('effect runs once immediately', () => {
  const spy = vi.fn();
  createRoot(() => {
    createEffect(spy);
  });
  expect(spy).toHaveBeenCalledTimes(1);
});

test('effect re-runs when a tracked signal changes', () => {
  const [count, setCount] = createSignal(0);
  const seen: number[] = [];
  createRoot(() => {
    createEffect(() => {
      seen.push(count());
    });
  });
  setCount(1);
  setCount(2);
  expect(seen).toEqual([0, 1, 2]);
});

test('effect does not re-run for untracked signals', () => {
  const [a, setA] = createSignal(0);
  const [b, setB] = createSignal(0);
  const spy = vi.fn(() => a());
  createRoot(() => createEffect(spy));
  setB(1);
  expect(spy).toHaveBeenCalledTimes(1);
});

test('dependencies are re-collected each run (dynamic deps)', () => {
  const [toggle, setToggle] = createSignal(true);
  const [a, setA] = createSignal('a');
  const [b, setB] = createSignal('b');
  const seen: string[] = [];
  createRoot(() => {
    createEffect(() => {
      seen.push(toggle() ? a() : b());
    });
  });
  // currently tracking `a`; changing `b` must not re-run
  setB('b2');
  expect(seen).toEqual(['a']);
  // switch to tracking `b`
  setToggle(false);
  expect(seen).toEqual(['a', 'b2']);
  // now changing `a` must not re-run; changing `b` must
  setA('a2');
  expect(seen).toEqual(['a', 'b2']);
  setB('b3');
  expect(seen).toEqual(['a', 'b2', 'b3']);
});

test('onCleanup runs before each re-run and on dispose', () => {
  const [count, setCount] = createSignal(0);
  const cleanup = vi.fn();
  let dispose!: () => void;
  createRoot((d) => {
    dispose = d;
    createEffect(() => {
      count();
      onCleanup(cleanup);
    });
  });
  expect(cleanup).toHaveBeenCalledTimes(0);
  setCount(1); // cleanup for the first run fires before the second run
  expect(cleanup).toHaveBeenCalledTimes(1);
  dispose(); // cleanup for the second run fires on dispose
  expect(cleanup).toHaveBeenCalledTimes(2);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run packages/reactivity/test/effect.test.ts`
Expected: FAIL — `createEffect` not exported.

- [ ] **Step 3: Replace core.ts with the full engine**

`packages/reactivity/src/core.ts` (full file):
```ts
// Fine-grained reactive engine (SolidJS / `reactively`-style).
// Synchronous, glitch-free, lazy memos. No DOM APIs — platform-agnostic.

export type EqualsFn<T> = (prev: T, next: T) => boolean;
export const defaultEquals = <T>(a: T, b: T): boolean => a === b;

// ---- node states ----
const CLEAN = 0;
const CHECK = 1;
const STALE = 2;
const DISPOSED = 3;
type State = 0 | 1 | 2 | 3;

// A "source" can be observed. Plain signals are SignalState; memos are Computations
// (which structurally include value/observers/equals, so they are sources too).
export interface SignalState<T> {
  value: T;
  observers: Computation<any>[] | null;
  equals: EqualsFn<T> | false;
}

export interface Owner {
  owned: Computation<any>[] | null;
  cleanups: (() => void)[] | null;
  owner: Owner | null;
}

export interface Computation<T> extends Owner, SignalState<T> {
  fn: ((prev: T) => T) | null;
  state: State;
  sources: SignalState<any>[] | null; // dependencies
  isMemo: boolean;
  isEffect: boolean;
}

// ---- globals ----
let currentListener: Computation<any> | null = null; // observer collecting deps
let currentOwner: Owner | null = null; // owner for cleanup
let Effects: Computation<any>[] | null = null; // non-null => inside an update batch
let runawayGuard = 0;
const RUNAWAY_LIMIT = 100000;

export function getOwner(): Owner | null {
  return currentOwner;
}

// ---- signal read/write ----
export function readSource<T>(node: SignalState<T>): T {
  if (currentListener) {
    (currentListener.sources || (currentListener.sources = [])).push(node);
    (node.observers || (node.observers = [])).push(currentListener);
  }
  return node.value;
}

export function writeSignal<T>(node: SignalState<T>, value: T): T {
  if (node.equals === false || !node.equals(node.value, value)) {
    node.value = value;
    const observers = node.observers;
    if (observers && observers.length) {
      runUpdates(() => {
        for (let i = 0; i < observers.length; i++) markDirty(observers[i], STALE);
      });
    }
  }
  return value;
}

// ---- dirty propagation ----
function markDirty(node: Computation<any>, state: State): void {
  if (node.state >= state) return;
  const wasClean = node.state === CLEAN;
  node.state = state;
  if (node.isMemo && node.observers) {
    for (let i = 0; i < node.observers.length; i++) markDirty(node.observers[i], CHECK);
  }
  if (node.isEffect && wasClean) scheduleEffect(node);
}

export function scheduleEffect(node: Computation<any>): void {
  (Effects || (Effects = [])).push(node);
}

// ---- pull/update machinery ----
export function updateIfNecessary(node: Computation<any>): void {
  if (node.state === CLEAN || node.state === DISPOSED) return;
  if (node.state === CHECK) {
    const sources = node.sources;
    if (sources) {
      for (let i = 0; i < sources.length; i++) {
        const source = sources[i] as Computation<any>;
        if (source.isMemo) updateIfNecessary(source);
        if (node.state === STALE) break;
      }
    }
  }
  if (node.state === STALE) runComputation(node);
  else node.state = CLEAN;
}

function runComputation<T>(node: Computation<T>): void {
  cleanNode(node);
  const prevListener = currentListener;
  const prevOwner = currentOwner;
  currentListener = node;
  currentOwner = node;
  let next: T;
  try {
    next = node.fn!(node.value);
  } finally {
    currentListener = prevListener;
    currentOwner = prevOwner;
  }
  if (node.isMemo) {
    if (node.equals === false || !node.equals(node.value, next)) {
      node.value = next;
      if (node.observers) {
        for (let i = 0; i < node.observers.length; i++) node.observers[i].state = STALE;
      }
    }
  } else {
    node.value = next;
  }
  node.state = CLEAN;
}

function cleanNode(node: Computation<any>): void {
  // unsubscribe from current sources
  const sources = node.sources;
  if (sources) {
    for (let i = 0; i < sources.length; i++) {
      const observers = sources[i].observers;
      if (observers) {
        const idx = observers.indexOf(node);
        if (idx !== -1) observers.splice(idx, 1);
      }
    }
    sources.length = 0;
  }
  // dispose owned children
  if (node.owned) {
    for (let i = 0; i < node.owned.length; i++) disposeNode(node.owned[i]);
    node.owned.length = 0;
  }
  // run cleanups
  if (node.cleanups) {
    for (let i = 0; i < node.cleanups.length; i++) node.cleanups[i]();
    node.cleanups.length = 0;
  }
}

function disposeNode(node: Computation<any>): void {
  cleanNode(node);
  node.state = DISPOSED;
  node.fn = null;
  node.observers = null;
}

// ---- batching / scheduling ----
export function runUpdates(fn: () => void): void {
  if (Effects) {
    // already inside an update — just schedule into the live queue
    fn();
    return;
  }
  Effects = [];
  runawayGuard = 0;
  try {
    fn();
    // drain — new effects scheduled during the drain are appended and processed
    for (let i = 0; i < Effects.length; i++) {
      if (++runawayGuard > RUNAWAY_LIMIT) {
        throw new Error('[cairn] Potential infinite update loop detected');
      }
      const e = Effects[i];
      if (e.state !== CLEAN && e.state !== DISPOSED) updateIfNecessary(e);
    }
  } finally {
    Effects = null;
  }
}

export function batch<T>(fn: () => T): T {
  if (Effects) return fn();
  let result!: T;
  runUpdates(() => {
    result = fn();
  });
  return result;
}

export function untrack<T>(fn: () => T): T {
  if (currentListener === null) return fn();
  const prev = currentListener;
  currentListener = null;
  try {
    return fn();
  } finally {
    currentListener = prev;
  }
}

// ---- computation construction ----
export function createComputation<T>(
  fn: (prev: T) => T,
  init: T,
  isMemo: boolean,
  isEffect: boolean,
  equals: EqualsFn<T> | false,
): Computation<T> {
  const node: Computation<T> = {
    fn,
    value: init,
    state: STALE,
    sources: null,
    observers: null,
    owned: null,
    cleanups: null,
    owner: currentOwner,
    isMemo,
    isEffect,
    equals,
  };
  if (currentOwner) (currentOwner.owned || (currentOwner.owned = [])).push(node);
  return node;
}

// ---- ownership ----
export function createRoot<T>(fn: (dispose: () => void) => T): T {
  const root: Owner = { owned: null, cleanups: null, owner: currentOwner };
  const prevOwner = currentOwner;
  const prevListener = currentListener;
  currentOwner = root;
  currentListener = null; // roots do not track
  try {
    return fn(() => disposeOwner(root));
  } finally {
    currentOwner = prevOwner;
    currentListener = prevListener;
  }
}

export function onCleanup(fn: () => void): () => void {
  if (currentOwner) {
    (currentOwner.cleanups || (currentOwner.cleanups = [])).push(fn);
  }
  return fn;
}

function disposeOwner(owner: Owner): void {
  if (owner.owned) {
    for (let i = 0; i < owner.owned.length; i++) disposeNode(owner.owned[i]);
    owner.owned = null;
  }
  if (owner.cleanups) {
    for (let i = 0; i < owner.cleanups.length; i++) owner.cleanups[i]();
    owner.cleanups = null;
  }
}
```

`packages/reactivity/src/effect.ts`:
```ts
import { createComputation, runUpdates, scheduleEffect, defaultEquals } from './core';

export function createEffect<T>(fn: (prev: T | undefined) => T, value?: T): void {
  const node = createComputation<T | undefined>(
    fn,
    value,
    false, // isMemo
    true, // isEffect
    defaultEquals,
  );
  runUpdates(() => scheduleEffect(node));
}
```

`packages/reactivity/src/index.ts`:
```ts
export const VERSION = '0.0.0';

export { createSignal } from './signal';
export type { Accessor, Setter, SignalOptions } from './signal';

export { createEffect } from './effect';

export { createRoot, onCleanup, batch, untrack, getOwner } from './core';
export type { Owner } from './core';
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run packages/reactivity/test/effect.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Run the full suite to check for regressions**

Run: `pnpm vitest run packages/reactivity`
Expected: PASS (all tests from Tasks 1–4).

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(reactivity): reactive engine with createEffect, tracking, scheduler"
```

---

## Task 5: batch

`batch` is already implemented in `core.ts` (Task 4) and exported. This task adds the behavioral tests that pin down batching semantics.

**Files:**
- Test: `packages/reactivity/test/batch.test.ts`

- [ ] **Step 1: Write the failing test**

`packages/reactivity/test/batch.test.ts`:
```ts
import { test, expect, vi } from 'vitest';
import { createSignal, createEffect, createRoot, batch } from '../src/index';

test('batch coalesces multiple writes into a single effect run', () => {
  const [a, setA] = createSignal(0);
  const spy = vi.fn(() => a());
  createRoot(() => createEffect(spy));
  expect(spy).toHaveBeenCalledTimes(1);

  batch(() => {
    setA(1);
    setA(2);
    setA(3);
  });
  expect(spy).toHaveBeenCalledTimes(2);
  expect(a()).toBe(3);
});

test('batch coalesces writes across multiple signals', () => {
  const [a, setA] = createSignal(0);
  const [b, setB] = createSignal(0);
  const spy = vi.fn(() => a() + b());
  createRoot(() => createEffect(spy));
  expect(spy).toHaveBeenCalledTimes(1);

  batch(() => {
    setA(1);
    setB(1);
  });
  expect(spy).toHaveBeenCalledTimes(2);
});

test('batch returns the callback result', () => {
  expect(batch(() => 99)).toBe(99);
});

test('reads inside batch see the latest written value', () => {
  const [a, setA] = createSignal(0);
  const observed = batch(() => {
    setA(5);
    return a();
  });
  expect(observed).toBe(5);
});
```

- [ ] **Step 2: Run test to verify it passes (behavior already implemented)**

Run: `pnpm vitest run packages/reactivity/test/batch.test.ts`
Expected: PASS (4 tests).

> If any test fails, the bug is in `writeSignal`/`runUpdates` in `core.ts` — fix there, do not weaken the test.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "test(reactivity): batching semantics"
```

---

## Task 6: untrack

`untrack` is already implemented in `core.ts` (Task 4). This task pins down its behavior.

**Files:**
- Test: `packages/reactivity/test/untrack.test.ts`

- [ ] **Step 1: Write the failing test**

`packages/reactivity/test/untrack.test.ts`:
```ts
import { test, expect, vi } from 'vitest';
import { createSignal, createEffect, createRoot, untrack } from '../src/index';

test('untracked reads do not create a dependency', () => {
  const [a, setA] = createSignal(0);
  const spy = vi.fn(() => untrack(() => a()));
  createRoot(() => createEffect(spy));
  expect(spy).toHaveBeenCalledTimes(1);
  setA(1);
  expect(spy).toHaveBeenCalledTimes(1);
});

test('untrack returns the callback result', () => {
  const [a] = createSignal(7);
  createRoot(() => {
    expect(untrack(() => a())).toBe(7);
  });
});

test('tracking resumes after untrack within the same effect', () => {
  const [a, setA] = createSignal(0);
  const [b, setB] = createSignal(0);
  const spy = vi.fn(() => {
    untrack(() => a()); // not tracked
    b(); // tracked
  });
  createRoot(() => createEffect(spy));
  expect(spy).toHaveBeenCalledTimes(1);
  setA(1); // no re-run
  expect(spy).toHaveBeenCalledTimes(1);
  setB(1); // re-run
  expect(spy).toHaveBeenCalledTimes(2);
});
```

- [ ] **Step 2: Run test to verify it passes (behavior already implemented)**

Run: `pnpm vitest run packages/reactivity/test/untrack.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "test(reactivity): untrack semantics"
```

---

## Task 7: createMemo

Memos are lazy derived values: cached, recomputed only when their dependencies change, and only actually evaluated when read.

**Files:**
- Create: `packages/reactivity/src/memo.ts`
- Modify: `packages/reactivity/src/index.ts`
- Test: `packages/reactivity/test/memo.test.ts`

- [ ] **Step 1: Write the failing test**

`packages/reactivity/test/memo.test.ts`:
```ts
import { test, expect, vi } from 'vitest';
import { createSignal, createMemo, createEffect, createRoot } from '../src/index';

test('memo computes a derived value', () => {
  const [a] = createSignal(2);
  createRoot(() => {
    const double = createMemo(() => a() * 2);
    expect(double()).toBe(4);
  });
});

test('memo recomputes when a dependency changes', () => {
  const [a, setA] = createSignal(2);
  createRoot(() => {
    const double = createMemo(() => a() * 2);
    expect(double()).toBe(4);
    setA(5);
    expect(double()).toBe(10);
  });
});

test('memo is cached — does not recompute when read repeatedly', () => {
  const [a, setA] = createSignal(1);
  const compute = vi.fn(() => a() * 2);
  createRoot(() => {
    const double = createMemo(compute);
    double();
    double();
    double();
    expect(compute).toHaveBeenCalledTimes(1);
    setA(2);
    double();
    double();
    expect(compute).toHaveBeenCalledTimes(2);
  });
});

test('memo is lazy — not computed until first read', () => {
  const compute = vi.fn(() => 1);
  createRoot(() => {
    createMemo(compute);
    expect(compute).not.toHaveBeenCalled();
  });
});

test('effects depending on a memo re-run when the memo changes', () => {
  const [a, setA] = createSignal(1);
  const seen: number[] = [];
  createRoot(() => {
    const double = createMemo(() => a() * 2);
    createEffect(() => seen.push(double()));
  });
  expect(seen).toEqual([2]);
  setA(3);
  expect(seen).toEqual([2, 6]);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run packages/reactivity/test/memo.test.ts`
Expected: FAIL — `createMemo` not exported.

- [ ] **Step 3: Create memo.ts and export it**

`packages/reactivity/src/memo.ts`:
```ts
import {
  createComputation,
  updateIfNecessary,
  readSource,
  defaultEquals,
  type EqualsFn,
} from './core';
import { type Accessor } from './signal';

export interface MemoOptions<T> {
  equals?: EqualsFn<T> | false;
}

export function createMemo<T>(
  fn: (prev: T | undefined) => T,
  value?: T,
  options?: MemoOptions<T>,
): Accessor<T> {
  const node = createComputation<T>(
    fn as (prev: T) => T,
    value as T,
    true, // isMemo
    false, // isEffect
    options?.equals ?? defaultEquals,
  );
  return () => {
    updateIfNecessary(node);
    return readSource(node);
  };
}
```

`packages/reactivity/src/index.ts`:
```ts
export const VERSION = '0.0.0';

export { createSignal } from './signal';
export type { Accessor, Setter, SignalOptions } from './signal';

export { createEffect } from './effect';
export { createMemo } from './memo';
export type { MemoOptions } from './memo';

export { createRoot, onCleanup, batch, untrack, getOwner } from './core';
export type { Owner } from './core';
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run packages/reactivity/test/memo.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(reactivity): createMemo (lazy, cached derived values)"
```

---

## Task 8: Glitch-free diamond updates

Verifies the CHECK/STALE algorithm: when an effect depends on two memos that both derive from the same signal, one write produces exactly one effect run — and it reads consistent (up-to-date) values. This behavior is already implemented; this task locks it with tests.

**Files:**
- Test: `packages/reactivity/test/glitch-free.test.ts`

- [ ] **Step 1: Write the failing test**

`packages/reactivity/test/glitch-free.test.ts`:
```ts
import { test, expect, vi } from 'vitest';
import { createSignal, createMemo, createEffect, createRoot } from '../src/index';

test('diamond: effect runs once per write, not once per path', () => {
  const [n, setN] = createSignal(1);
  const seen: number[] = [];
  const spy = vi.fn();
  createRoot(() => {
    const a = createMemo(() => n() + 1);
    const b = createMemo(() => n() * 10);
    createEffect(() => {
      spy();
      seen.push(a() + b());
    });
  });
  expect(spy).toHaveBeenCalledTimes(1);
  expect(seen).toEqual([12]); // (1+1) + (1*10)

  setN(2);
  expect(spy).toHaveBeenCalledTimes(2); // NOT 3
  expect(seen).toEqual([12, 23]); // (2+1) + (2*10)
});

test('deep chain of memos updates consistently', () => {
  const [n, setN] = createSignal(1);
  const seen: number[] = [];
  createRoot(() => {
    const a = createMemo(() => n() + 1);
    const b = createMemo(() => a() + 1);
    const c = createMemo(() => b() + 1);
    createEffect(() => seen.push(c()));
  });
  expect(seen).toEqual([4]); // 1+1+1+1
  setN(10);
  expect(seen).toEqual([4, 13]); // 10+1+1+1
});

test('memo that reads a memo is not recomputed when result is unaffected', () => {
  const [n, setN] = createSignal(2);
  const isEven = createMemo(() => n() % 2 === 0);
  const label = vi.fn(() => (isEven() ? 'even' : 'odd'));
  createRoot(() => {
    const l = createMemo(label);
    createEffect(() => l());
    expect(label).toHaveBeenCalledTimes(1);
    setN(4); // still even → isEven value unchanged → label memo need not recompute
    expect(label).toHaveBeenCalledTimes(1);
    setN(5); // now odd → recompute
    expect(label).toHaveBeenCalledTimes(2);
  });
});
```

> Note: the third test depends on memo equality short-circuiting (a memo whose value did not change does not mark its observers `STALE`). That is implemented in `runComputation` and further exercised in Task 9.

- [ ] **Step 2: Run test to verify it passes (behavior already implemented)**

Run: `pnpm vitest run packages/reactivity/test/glitch-free.test.ts`
Expected: PASS (3 tests).

> If a test fails, the bug is in `markDirty` / `updateIfNecessary` / `runComputation` — fix the engine, do not weaken the test.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "test(reactivity): glitch-free diamond and chained-memo updates"
```

---

## Task 9: Equality (no-op propagation)

Signals and memos both use an `equals` comparator (default `===`, or `false` to always notify). Equal values must not trigger downstream work.

**Files:**
- Test: `packages/reactivity/test/equals.test.ts`

- [ ] **Step 1: Write the failing test**

`packages/reactivity/test/equals.test.ts`:
```ts
import { test, expect, vi } from 'vitest';
import { createSignal, createMemo, createEffect, createRoot } from '../src/index';

test('setting a signal to an equal value does not re-run effects', () => {
  const [a, setA] = createSignal(1);
  const spy = vi.fn(() => a());
  createRoot(() => createEffect(spy));
  expect(spy).toHaveBeenCalledTimes(1);
  setA(1); // same value
  expect(spy).toHaveBeenCalledTimes(1);
  setA(2); // changed
  expect(spy).toHaveBeenCalledTimes(2);
});

test('equals: false always notifies', () => {
  const [a, setA] = createSignal(1, { equals: false });
  const spy = vi.fn(() => a());
  createRoot(() => createEffect(spy));
  expect(spy).toHaveBeenCalledTimes(1);
  setA(1); // same value, but equals:false forces notify
  expect(spy).toHaveBeenCalledTimes(2);
});

test('custom equals controls signal notification', () => {
  const [obj, setObj] = createSignal(
    { id: 1, label: 'a' },
    { equals: (p, n) => p.id === n.id },
  );
  const spy = vi.fn(() => obj());
  createRoot(() => createEffect(spy));
  expect(spy).toHaveBeenCalledTimes(1);
  setObj({ id: 1, label: 'b' }); // same id → treated equal → no re-run
  expect(spy).toHaveBeenCalledTimes(1);
  setObj({ id: 2, label: 'b' }); // different id → re-run
  expect(spy).toHaveBeenCalledTimes(2);
});

test('memo whose value is unchanged does not re-run dependents', () => {
  const [n, setN] = createSignal(2);
  const parity = createMemo(() => n() % 2); // 0 for even
  const spy = vi.fn(() => parity());
  createRoot(() => createEffect(spy));
  expect(spy).toHaveBeenCalledTimes(1);
  setN(4); // parity still 0 → dependent effect must not re-run
  expect(spy).toHaveBeenCalledTimes(1);
  setN(3); // parity now 1 → re-run
  expect(spy).toHaveBeenCalledTimes(2);
});
```

- [ ] **Step 2: Run test to verify it passes (behavior already implemented)**

Run: `pnpm vitest run packages/reactivity/test/equals.test.ts`
Expected: PASS (4 tests).

> If the memo-equality test fails, verify `runComputation` only marks observers `STALE` when `!node.equals(node.value, next)`.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "test(reactivity): equality-based no-op propagation"
```

---

## Task 10: Reactive disposal + nested ownership + runaway guard

Verifies that disposing a root stops its effects, that effects created inside effects are disposed on re-run, and that an accidental infinite update loop throws instead of hanging.

**Files:**
- Test: `packages/reactivity/test/disposal.test.ts`

- [ ] **Step 1: Write the failing test**

`packages/reactivity/test/disposal.test.ts`:
```ts
import { test, expect, vi } from 'vitest';
import { createSignal, createEffect, createRoot } from '../src/index';

test('disposing the root stops its effects', () => {
  const [a, setA] = createSignal(0);
  const spy = vi.fn(() => a());
  let dispose!: () => void;
  createRoot((d) => {
    dispose = d;
    createEffect(spy);
  });
  expect(spy).toHaveBeenCalledTimes(1);
  setA(1);
  expect(spy).toHaveBeenCalledTimes(2);
  dispose();
  setA(2);
  expect(spy).toHaveBeenCalledTimes(2); // no more runs
});

test('nested effect is disposed and recreated across parent re-runs', () => {
  const [outer, setOuter] = createSignal(0);
  const [inner, setInner] = createSignal(0);
  const innerSpy = vi.fn(() => inner());
  createRoot(() => {
    createEffect(() => {
      outer();
      createEffect(innerSpy); // child owned by the outer effect
    });
  });
  // outer ran once → inner created + ran once
  expect(innerSpy).toHaveBeenCalledTimes(1);

  setInner(1); // one live inner effect re-runs
  expect(innerSpy).toHaveBeenCalledTimes(2);

  setOuter(1); // outer re-runs: old inner disposed, a new inner created + runs
  expect(innerSpy).toHaveBeenCalledTimes(3);

  setInner(2); // only the newest inner is alive → exactly one more run
  expect(innerSpy).toHaveBeenCalledTimes(4);
});

test('an infinite update loop throws instead of hanging', () => {
  expect(() => {
    createRoot(() => {
      const [a, setA] = createSignal(0);
      createEffect(() => {
        setA(a() + 1); // writes its own dependency → self-perpetuating
      });
    });
  }).toThrow(/infinite update loop/i);
});
```

- [ ] **Step 2: Run test to verify it passes (behavior already implemented)**

Run: `pnpm vitest run packages/reactivity/test/disposal.test.ts`
Expected: PASS (3 tests).

> If "nested effect" fails, verify `cleanNode` disposes `node.owned` before re-running. If the loop test hangs instead of throwing, verify the `runawayGuard` check in `runUpdates`.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "test(reactivity): disposal, nested ownership, runaway-loop guard"
```

---

## Task 11: Typecheck, full suite, and README

Finalize: ensure strict typechecking passes, the whole suite is green, and there is a short usage README.

**Files:**
- Create: `packages/reactivity/README.md`

- [ ] **Step 1: Run the full test suite**

Run: `pnpm vitest run packages/reactivity`
Expected: PASS — all tests from Tasks 1–10 green.

- [ ] **Step 2: Run the typechecker**

Run: `pnpm exec tsc --noEmit -p packages/reactivity/tsconfig.json`
Expected: no type errors.

> If errors appear, fix them in `src/` without loosening `strict`. Do not add `any` beyond the intentional `Computation<any>` graph edges already present.

- [ ] **Step 3: Write the README**

`packages/reactivity/README.md`:
````markdown
# @cairn/reactivity

Fine-grained reactive core for the Cairn framework. SolidJS-style primitives,
built from scratch, with no DOM dependencies.

## API

- `createSignal(value, options?)` → `[read, write]`
- `createMemo(fn, value?, options?)` → `read` (lazy, cached)
- `createEffect(fn)` — runs immediately and re-runs when tracked deps change
- `createRoot(fn)` — creates a disposal scope; `fn` receives a `dispose()`
- `onCleanup(fn)` — register a cleanup for the current scope
- `batch(fn)` — coalesce multiple writes into one update
- `untrack(fn)` — read without subscribing

## Example

```ts
import { createSignal, createMemo, createEffect, createRoot } from '@cairn/reactivity';

createRoot((dispose) => {
  const [count, setCount] = createSignal(0);
  const doubled = createMemo(() => count() * 2);

  createEffect(() => {
    console.log(count(), doubled());
  });

  setCount(1); // logs: 1 2
  setCount(2); // logs: 2 4

  dispose(); // stops the effect
});
```

## Guarantees

- **Glitch-free:** a diamond dependency triggers each effect once per update.
- **Lazy memos:** a memo is only computed when read, and cached until a dep changes.
- **Automatic batching:** all writes triggered by one signal update are coalesced.
````

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "docs(reactivity): usage README; finalize @cairn/reactivity v0"
```

---

## Self-Review Notes (for the implementer)

- **Spec coverage:** This plan implements every Phase 1 deliverable from the design spec — `createSignal`, `createEffect`, `createMemo`, `batch`, `untrack`, `onCleanup`, `createRoot`, dependency graph (owner tree), automatic read tracking, and glitch-free recomputation. `createContext` is intentionally **out of scope** here — it is Phase 5 in the roadmap (it builds on this owner tree but is not part of the reactivity core delivery).
- **Order of tasks:** Tasks 5, 6, 8, 9, 10 test behavior implemented by the Task 4/7 engine. This is deliberate — the engine is an atomic algorithm; these tasks pin its contract with focused tests. If a "should already pass" test fails, fix the engine, never the test.
- **Type consistency:** `createComputation(fn, init, isMemo, isEffect, equals)` has the same 5-arg signature everywhere it is called (`effect.ts`, `memo.ts`). `readSource`/`writeSignal`/`updateIfNecessary`/`scheduleEffect`/`runUpdates` names are used identically across `core.ts`, `signal.ts`, `memo.ts`, `effect.ts`.
```
