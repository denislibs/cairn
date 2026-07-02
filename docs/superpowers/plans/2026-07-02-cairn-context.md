# Cairn Context Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add dependency-injection Context to Cairn: `createContext` / `useContext` / `runWithContext` in `@cairn/reactivity` (owner-tree based), and a thin `<Provider>` in `@cairn/runtime`.

**Architecture:** SolidJS-style — each owner/computation carries a `context` map inherited (by reference) from its parent at creation. `runWithContext` runs a function in a child owner scope whose context has the value set; `useContext` reads the current owner's context (or the default). The provider scope is disposed with its parent via the existing `cleanups` mechanism (no leak). Because context lives on the private `currentOwner`, the core functions are implemented in `core.ts`. `<Provider>` uses a children **thunk** to work around eager JSX child evaluation.

**Tech Stack:** TypeScript (strict, `lib: ES2022`, no DOM), pnpm workspaces, Vitest.

---

## File Structure

```
packages/reactivity/src/core.ts        # MODIFY: Context types, Owner.context, inheritance, createContext/useContext/runWithContext
packages/reactivity/src/index.ts       # MODIFY: export the three functions + Context type
packages/reactivity/test/context.test.ts  # new
packages/runtime/src/provider.ts       # new: Provider
packages/runtime/src/index.ts          # MODIFY: export Provider + ProviderProps
packages/runtime/test/provider.test.ts # new
```

---

## Task 1: Context types, owner inheritance, createContext + useContext

**Files:**
- Modify: `packages/reactivity/src/core.ts`
- Modify: `packages/reactivity/src/index.ts`
- Test: `packages/reactivity/test/context.test.ts`

- [ ] **Step 1: Write the failing test**

`packages/reactivity/test/context.test.ts`:
```ts
import { test, expect } from 'vitest';
import { createContext, useContext } from '../src/index';

test('createContext returns a context with a unique id and default', () => {
  const a = createContext('x');
  const b = createContext('y');
  expect(a.defaultValue).toBe('x');
  expect(typeof a.id).toBe('symbol');
  expect(a.id).not.toBe(b.id);
});

test('useContext returns the default when nothing is provided', () => {
  const ctx = createContext(42);
  expect(useContext(ctx)).toBe(42);
});

test('two distinct contexts do not interfere at their defaults', () => {
  const theme = createContext('light');
  const lang = createContext('en');
  expect(useContext(theme)).toBe('light');
  expect(useContext(lang)).toBe('en');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run packages/reactivity/test/context.test.ts`
Expected: FAIL — `createContext` / `useContext` not exported.

- [ ] **Step 3: Add Context types to core.ts**

In `packages/reactivity/src/core.ts`, add this block right after the `defaultEquals` line (after line 5, before `// ---- node states ----`):
```ts

// ---- context ----
export interface Context<T> {
  readonly id: symbol;
  readonly defaultValue: T;
}
```

- [ ] **Step 4: Add the `context` field to `Owner`**

In `core.ts`, replace the `Owner` interface:
```ts
export interface Owner {
  owned: Computation<any>[] | null;
  cleanups: (() => void)[] | null;
  owner: Owner | null;
}
```
with:
```ts
export interface Owner {
  owned: Computation<any>[] | null;
  cleanups: (() => void)[] | null;
  owner: Owner | null;
  context?: Record<symbol, unknown>;
}
```

- [ ] **Step 5: Inherit context in `createComputation`**

In `core.ts`, in `createComputation`, replace the node literal's `owner: currentOwner,` line:
```ts
    owner: currentOwner,
    isMemo,
    isEffect,
    equals,
  };
```
with:
```ts
    owner: currentOwner,
    context: currentOwner ? currentOwner.context : undefined,
    isMemo,
    isEffect,
    equals,
  };
```

- [ ] **Step 6: Inherit context in `createRoot`**

In `core.ts`, replace the `createRoot` root literal:
```ts
  const root: Owner = { owned: null, cleanups: null, owner: currentOwner };
```
with:
```ts
  const root: Owner = {
    owned: null,
    cleanups: null,
    owner: currentOwner,
    context: currentOwner ? currentOwner.context : undefined,
  };
```

- [ ] **Step 7: Add `createContext` + `useContext` at the end of core.ts**

Append to `packages/reactivity/src/core.ts`:
```ts

// Create a context token carrying a default value.
export function createContext<T>(defaultValue: T): Context<T> {
  return { id: Symbol('cairn-context'), defaultValue };
}

// Read the current owner's context value for `ctx`, or the default.
export function useContext<T>(ctx: Context<T>): T {
  const map = currentOwner ? currentOwner.context : undefined;
  const value = map ? map[ctx.id] : undefined;
  return value !== undefined ? (value as T) : ctx.defaultValue;
}
```

- [ ] **Step 8: Export from index.ts**

Append to `packages/reactivity/src/index.ts`:
```ts
export { createContext, useContext } from './core';
export type { Context } from './core';
```

- [ ] **Step 9: Run test + typecheck**

Run: `pnpm vitest run packages/reactivity/test/context.test.ts`
Expected: PASS (3 tests).

Run: `pnpm vitest run packages/reactivity`
Expected: PASS (existing reactivity tests still green + 3 new).

Run: `pnpm typecheck`
Expected: no errors.

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "feat(reactivity): context types, owner inheritance, createContext + useContext"
```

---

## Task 2: runWithContext (provision, nesting, effects, disposal)

**Files:**
- Modify: `packages/reactivity/src/core.ts`
- Modify: `packages/reactivity/src/index.ts`
- Test: `packages/reactivity/test/context.test.ts` (append)

- [ ] **Step 1: Append the failing tests**

Append to `packages/reactivity/test/context.test.ts`:
```ts
import { createRoot, createSignal, createEffect } from '../src/index';
import { runWithContext } from '../src/index';

test('runWithContext makes useContext return the provided value inside fn', () => {
  const ctx = createContext('default');
  let inside = '';
  const outside = runWithContext(ctx, 'provided', () => {
    inside = useContext(ctx);
    return useContext(ctx);
  });
  expect(inside).toBe('provided');
  expect(outside).toBe('provided');
  // reverts outside the scope
  expect(useContext(ctx)).toBe('default');
});

test('nested runWithContext overrides for the same context', () => {
  const ctx = createContext('a');
  const seen: string[] = [];
  runWithContext(ctx, 'b', () => {
    seen.push(useContext(ctx));
    runWithContext(ctx, 'c', () => {
      seen.push(useContext(ctx));
    });
    seen.push(useContext(ctx));
  });
  expect(seen).toEqual(['b', 'c', 'b']);
});

test('runWithContext inherits outer contexts for other keys', () => {
  const theme = createContext('light');
  const lang = createContext('en');
  let seenLang = '';
  runWithContext(theme, 'dark', () => {
    runWithContext(lang, 'fr', () => {
      seenLang = useContext(lang);
      expect(useContext(theme)).toBe('dark'); // inherited from the outer scope
    });
  });
  expect(seenLang).toBe('fr');
});

test('an effect created inside a provider sees the context value, incl. on re-run', () => {
  const ctx = createContext('default');
  const [n, setN] = createSignal(0);
  const seen: string[] = [];
  const dispose = createRoot((d) => {
    runWithContext(ctx, 'provided', () => {
      createEffect(() => {
        n(); // track
        seen.push(useContext(ctx));
      });
    });
    return d;
  });
  expect(seen).toEqual(['provided']); // initial run
  setN(1);
  expect(seen).toEqual(['provided', 'provided']); // re-run still sees the context
  dispose();
});

test('disposing the parent root disposes effects created inside a provider', () => {
  const ctx = createContext(0);
  const [n, setN] = createSignal(0);
  let runs = 0;
  const dispose = createRoot((d) => {
    runWithContext(ctx, 1, () => {
      createEffect(() => {
        n();
        runs++;
      });
    });
    return d;
  });
  expect(runs).toBe(1);
  setN(1);
  expect(runs).toBe(2);
  dispose();
  setN(2);
  expect(runs).toBe(2); // effect inside the provider was disposed with the root
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run packages/reactivity/test/context.test.ts`
Expected: FAIL — `runWithContext` not exported.

- [ ] **Step 3: Implement runWithContext in core.ts**

Append to `packages/reactivity/src/core.ts`:
```ts

// Run `fn` in a child owner scope where useContext(ctx) yields `value`. The scope is
// disposed together with its parent (via the parent's cleanups), so effects created
// inside it do not leak.
export function runWithContext<T, R>(ctx: Context<T>, value: T, fn: () => R): R {
  const parent = currentOwner;
  const scope: Owner = {
    owned: null,
    cleanups: null,
    owner: parent,
    context: { ...(parent ? parent.context : undefined), [ctx.id]: value },
  };
  currentOwner = scope;
  try {
    return fn();
  } finally {
    currentOwner = parent;
    if (parent) {
      (parent.cleanups || (parent.cleanups = [])).push(() => disposeOwner(scope));
    }
  }
}
```

Note: `disposeOwner` is already defined in `core.ts` (used by `createRoot`). `runWithContext`
is defined after it in file order — that is fine because it is only called at runtime, after
the module has fully evaluated.

- [ ] **Step 4: Export from index.ts**

Append to `packages/reactivity/src/index.ts`:
```ts
export { runWithContext } from './core';
```

- [ ] **Step 5: Run test + typecheck**

Run: `pnpm vitest run packages/reactivity/test/context.test.ts`
Expected: PASS (8 tests total in this file).

Run: `pnpm vitest run packages/reactivity`
Expected: PASS (all reactivity tests).

Run: `pnpm typecheck`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(reactivity): runWithContext (provision, nesting, disposal)"
```

---

## Task 3: Provider (runtime)

**Files:**
- Create: `packages/runtime/src/provider.ts`
- Modify: `packages/runtime/src/index.ts`
- Test: `packages/runtime/test/provider.test.ts`

- [ ] **Step 1: Write the failing test**

`packages/runtime/test/provider.test.ts`:
```ts
import { test, expect } from 'vitest';
import { BoxNode } from '@cairn/layout';
import { createContext, useContext } from '@cairn/reactivity';
import { Provider, type Instance } from '../src/index';

const Ctx = createContext('default');

function leaf(): Instance {
  return { layout: new BoxNode({ width: 1, height: 1 }), children: [], paintSelf() {} };
}

test('Provider exposes its value to useContext inside the children thunk', () => {
  let seen = '';
  const child = () => {
    seen = useContext(Ctx);
    return leaf();
  };
  const inst = Provider({ context: Ctx, value: 'provided', children: child });
  expect(seen).toBe('provided');
  // Provider returns whatever the children thunk returned
  expect(inst.layout).toBeInstanceOf(BoxNode);
});

test('useContext outside any provider returns the default', () => {
  expect(useContext(Ctx)).toBe('default');
});

test('Provider value is scoped: reading after Provider returns the default again', () => {
  Provider({ context: Ctx, value: 'scoped', children: () => leaf() });
  expect(useContext(Ctx)).toBe('default');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run packages/runtime/test/provider.test.ts`
Expected: FAIL — `Provider` not exported.

- [ ] **Step 3: Implement provider.ts and export it**

`packages/runtime/src/provider.ts`:
```ts
import { runWithContext, type Context } from '@cairn/reactivity';
import type { Instance } from './instance';

export interface ProviderProps<T> {
  context: Context<T>;
  value: T;
  // A thunk, evaluated inside the context scope so useContext sees `value`.
  children: () => Instance;
}

// Provide a context value to a subtree. Because our JSX evaluates children eagerly,
// `children` is a thunk that Provider invokes inside the context scope.
export function Provider<T>(props: ProviderProps<T>): Instance {
  return runWithContext(props.context, props.value, () => props.children());
}
```

`packages/runtime/src/index.ts` (append):
```ts
export { Provider } from './provider';
export type { ProviderProps } from './provider';
```

- [ ] **Step 4: Run test + typecheck**

Run: `pnpm vitest run packages/runtime/test/provider.test.ts`
Expected: PASS (3 tests).

Run: `pnpm vitest run packages/runtime`
Expected: PASS (all runtime tests + provider).

Run: `pnpm typecheck`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(runtime): Provider (context via children thunk)"
```

---

## Task 4: README notes + full-workspace green

**Files:**
- Modify: `packages/reactivity/README.md`
- Modify: `packages/runtime/README.md`

- [ ] **Step 1: Add a Context note to the reactivity README**

Append to `packages/reactivity/README.md`:
```markdown

## Context

- `createContext(defaultValue)` → a context token.
- `useContext(ctx)` → the current owner's provided value, else the default.
- `runWithContext(ctx, value, fn)` → run `fn` in a scope where `useContext(ctx)` yields `value`.

Context lookup is not reactive; put a signal/store in the context for reactive values. The
provided scope is disposed with its parent owner.
```

- [ ] **Step 2: Add a Provider note to the runtime README**

Append to `packages/runtime/README.md`:
```markdown

## Provider

`Provider({ context, value, children })` provides a context value to a subtree. Because JSX
children are evaluated eagerly, `children` is a thunk run inside the context scope:

    <Provider context={ThemeCtx} value={dark}>{() => <App />}</Provider>
```

- [ ] **Step 3: Run the full workspace suite + typecheck**

Run: `pnpm vitest run`
Expected: PASS — all packages green (reactivity + host + platform-web + layout + runtime + primitives).

Run: `pnpm typecheck`
Expected: no errors across all six packages.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "docs: Context/Provider usage notes; finalize Phase 5"
```

---

## Self-Review Notes (for the implementer)

- **Spec coverage:** `createContext`/`useContext` + Owner.context inheritance → Task 1. `runWithContext` (provision, nesting, cross-key inheritance, effect-inside incl. re-run, disposal) → Task 2. `<Provider>` (children thunk) → Task 3. READMEs → Task 4.
- **Deviation from spec file layout:** the spec proposed `reactivity/src/context.ts`, but the functions need the private `currentOwner`/`disposeOwner` in `core.ts`, so they are implemented in `core.ts` (no new file). This keeps `currentOwner` encapsulated. Behavior matches the spec exactly.
- **Type consistency:** `Context<T> = { id: symbol; defaultValue: T }`, `createContext<T>(defaultValue: T): Context<T>`, `useContext<T>(ctx): T`, `runWithContext<T,R>(ctx, value, fn): R` are used identically in core, exports, and the runtime Provider. `Owner.context` is `Record<symbol, unknown> | undefined`; context maps are keyed by `ctx.id`.
- **No leak:** provider scopes register `disposeOwner(scope)` on the parent's `cleanups`, exercised by the disposal test in Task 2.
- **Reactivity semantics:** context lookup is not reactive; the effect-inside test confirms the value is stable across re-runs (a signal in the context would drive reactivity, but that is the consumer's choice).
```
