# Cairn Phase 5 — Context (`@cairn/reactivity` core + `@cairn/runtime` Provider) — Design

**Date:** 2026-07-02
**Status:** approved design
**Depends on:** Phase 1 (`@cairn/reactivity` owner tree) and Phase 4 (`@cairn/runtime` Instance) — merged to main.

## Goal

Dependency-injection via the owner tree: `createContext` / `useContext` / `runWithContext` in
the reactivity core, plus a thin `<Provider>` in the runtime. Foundation for `ThemeProvider`
(Phase 6) and the router (Phase 16).

## Decisions

| Area | Decision |
|---|---|
| Home | Core (`createContext`/`useContext`/`runWithContext`) in `@cairn/reactivity` (owner tree lives there); `<Provider>` in `@cairn/runtime` |
| Model | Context stored per-owner and inherited down at owner/computation creation (SolidJS model) |
| Eager children | Our JSX has no compiler, so children are eager. `<Provider>` takes a **children thunk** (`children: () => Instance`) so context is set before children build |
| `createContext` default | Required (`createContext<T>(defaultValue: T)`) for clean types; pass an explicit default for "optional" contexts |
| Reactivity | Context lookup is NOT reactive; put a signal/store in the context for reactive values |

## Core API (`@cairn/reactivity`)

```ts
export interface Context<T> {
  readonly id: symbol;
  readonly defaultValue: T;
}

export function createContext<T>(defaultValue: T): Context<T>;
export function useContext<T>(ctx: Context<T>): T;
export function runWithContext<T, R>(ctx: Context<T>, value: T, fn: () => R): R;
```

- `createContext(defaultValue)` → `{ id: Symbol(), defaultValue }`.
- `useContext(ctx)` → the value from the current owner's inherited context, else `ctx.defaultValue`.
- `runWithContext(ctx, value, fn)` → run `fn` in a child owner scope where `useContext(ctx)` yields `value`.

## Core changes (`reactivity/src/core.ts`)

1. Add `context?: ContextRecord` to `Owner` (where `ContextRecord = Record<symbol, unknown>`);
   `Computation<T>` inherits it via `extends Owner`.
2. `createComputation` and `createRoot` inherit the parent's `context` **by reference**
   (`context: currentOwner?.context`). Because `runComputation` sets `currentOwner = node`
   during a re-run, and the node carries its `context`, `useContext` works during re-runs and
   child computations created then inherit the same context.
3. `runWithContext(ctx, value, fn)`: create a child `Owner` with
   `context = { ...(parent?.context), [ctx.id]: value }`, set it as `currentOwner`, run `fn`,
   restore `currentOwner` in a `finally`. Register `disposeOwner(childOwner)` on the parent via
   `parent.cleanups` so effects created inside the provider scope are torn down with the parent
   (no leak). If there is no parent owner, the scope is standalone (still runs `fn`).

`useContext` reads `currentOwner?.context?.[ctx.id]`; returns it when not `undefined`, else
`ctx.defaultValue`.

## Provider (`@cairn/runtime`)

```ts
import { runWithContext, type Context } from '@cairn/reactivity';
import type { Instance } from './instance';

export interface ProviderProps<T> {
  context: Context<T>;
  value: T;
  children: () => Instance; // thunk — evaluated inside the context scope
}

export function Provider<T>(props: ProviderProps<T>): Instance {
  return runWithContext(props.context, props.value, () => props.children());
}
```

Usage: `<Provider context={ThemeCtx} value={dark}>{() => <App />}</Provider>`. The children
thunk runs inside `runWithContext`, so `useContext(ThemeCtx)` inside it sees `dark`.

## Testing

**reactivity (`context.test.ts`):**
- `useContext` with no provider returns the default.
- `runWithContext` makes `useContext` return the value inside `fn`; outside it reverts.
- Nested `runWithContext` for the same context overrides; siblings are independent.
- An effect created inside `runWithContext` sees the context value on its initial run and on
  re-run (change a signal it reads, assert the captured context value is stable).
- Disposing the parent root disposes effects created inside a provider scope (cleanup runs).
- Two different contexts coexist without interference.

**runtime (`provider.test.ts`):**
- `Provider` runs its children thunk with the context value visible via `useContext`.
- A component built inside `Provider` reads the provided value; a component outside reads the default.

## Exit criteria

- `createContext`/`useContext`/`runWithContext` in `@cairn/reactivity`; `Provider` in `@cairn/runtime`.
- Context inherited down the owner tree; correct under effect re-runs; no leak (provider scope
  disposed with its parent).
- `pnpm typecheck` + `pnpm vitest run` green across the workspace.

## Out of scope (later phases)

- `ThemeProvider` and theme tokens (Phase 6).
- Reactively swapping a provider's `value` by rebuilding the subtree — not needed; put a signal
  in the context for reactive values.
- Router context (Phase 16), which builds on this.
