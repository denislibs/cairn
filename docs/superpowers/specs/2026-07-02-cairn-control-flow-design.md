# Cairn Phase 9 — Control Flow — Design

**Date:** 2026-07-02
**Status:** approved design
**Depends on:** reactivity, layout, runtime, primitives, events — all merged to main.
**Milestone:** dynamic UI; showcase = a todo app.

## Goal

Dynamic children in a tree that is otherwise built once. Add `<Show>`, `<For>` (keyed
reconciliation), `<Index>`, `<Switch>`/`<Match>` — reactive control-flow that adds/removes/
reorders instances and disposes removed subtrees. Showcase: a working todo app.

## Core approach

A parent `Flex` reads its layout children at construction, so dynamic items must live under a
single layout node. **Each control-flow component is a container** (its own layout node) whose
children are maintained by a reactive effect. On change the effect mutates the container's
`children` + its layout node's children and calls `scheduleFrame()`; the full-frame model then
re-lays-out/repaints. Per-item reactive scopes (`createRoot`) are disposed on removal (subtree
cleanup).

**Tracking discipline (critical):** the reconciling effect must track only its data source
(`each()` / `when()`), never the internals of the items it builds. Item/branch construction runs
inside `untrack(() => createRoot(...))` so signals read within a child body subscribe that child's
own effects — not the reconciler — otherwise an item-internal signal change would rebuild the whole
list. The `onCleanup` that disposes item scopes is registered **once at construction**, not inside
the effect (an effect-scoped cleanup would fire on every re-run).

Trade-off: control flow adds one layout node (a `<For>` is a column of rows). Transparent
fragment-flattening (no wrapper node) is deferred — bigger runtime change, not needed now.

**Package:** `@cairn/runtime` (has reactivity + layout + Instance; no `@cairn/style` needed —
control-flow containers take plain `direction`/`gap` props, not `StyleInput`).

## Layout addition: `FlexNode.mainAxisSize`

`FlexNode` currently always fills the main axis (`ownMain = mainMax`). Lists want to shrink-wrap
to their content. Add `mainAxisSize?: 'min' | 'max'` (default `'max'`, current behavior). When
`'min'`, `ownMain = clamp(contentMain, minMain, mainMax)`. `<For>`/`<Index>` default their
container to `'min'` so a list is as tall as its items.

## `<Show>` (`show.ts`)

```tsx
<Show when={() => cond()} fallback={() => <Text>empty</Text>}>
  {() => <Content />}
</Show>
```
- `ShowProps { when: () => unknown; children: () => Instance; fallback?: () => Instance }`.
  `children`/`fallback` are thunks (avoid eager eval of both branches, like `Provider`).
- Container: a `BoxNode` (no padding) holding one child. An effect tracks `when()`:
  when truthiness flips, dispose the previous branch's `createRoot` scope, build the new branch
  in a fresh `createRoot`, set the box's single child (`layout.children = [child.layout]`,
  `instance.children = [child]`), `scheduleFrame()`. `onCleanup` disposes the active scope.
- Boolean coercion: only re-render when the *truthiness* of `when()` changes (memoized), so
  updating a truthy value without crossing false doesn't rebuild.

## `<For>` — keyed list (`for.ts`)

```tsx
<For each={() => todos()} key={(t) => t.id} fallback={() => <Text>empty</Text>} gap={8}>
  {(item, index) => <TodoRow item={item} />}
</For>
```
- `ForProps<T> { each: () => T[]; children: (item: T, index: number) => Instance; key?: (item: T, index: number) => unknown; fallback?: () => Instance; direction?: 'row' | 'column'; gap?: number }`.
- Container: a `FlexNode` (`direction` default `'column'`, `gap`, `mainAxisSize: 'min'`).
- **Keyed reconciliation** in an effect over `each()`:
  - State: `Map<key, { instance, dispose, index }>` + current ordered key list.
  - `key` defaults to item identity (`(item) => item`).
  - New key → build `createRoot((d) => children(item, i))`, store `{ instance, dispose }`.
  - Missing key (present before, gone now) → call its `dispose` (cleans the item's effects) and drop it.
  - Surviving key → **reuse** the existing instance (state preserved); no rebuild.
  - Rebuild the ordered `instance.children` + `flex.children` to match the new key order (reorder), `scheduleFrame()`.
  - Empty `each()` and a `fallback` → render the fallback (its own scope); otherwise no children.
  - `onCleanup` disposes every remaining item scope (+ fallback) when the `<For>` unmounts.
- `index` is the item's current position at reconcile time (a number; passed to `children`).

## `<Index>` — index-keyed list (`index-cf.ts`)

```tsx
<Index each={() => rows()}>{(item, i) => <Row value={item} />}</Index>
```
- `IndexProps<T> { each: () => T[]; children: (item: () => T, index: number) => Instance; fallback?: () => Instance; direction?; gap? }`.
- Container: a `FlexNode` (`mainAxisSize: 'min'`). Keyed by **position**.
- State: per-slot `{ setItem, instance, dispose }`. On `each()` change:
  - For each index `< min(oldLen, newLen)`: `setItem(newItem)` — the slot's item signal updates,
    the row's reactive bits re-render, **instance reused** (no rebuild).
  - Grow: create new slots (`createRoot`, each with an item signal) via `children(() => item, i)`.
  - Shrink: dispose extra slots.
  - Update container children only when length changed; `scheduleFrame()`.

## `<Switch>` / `<Match>` (`switch.ts`)

```tsx
<Switch fallback={() => <Text>none</Text>}>
  <Match when={() => a()}>{() => <A />}</Match>
  <Match when={() => b()}>{() => <B />}</Match>
</Switch>
```
- `<Match>` returns a **descriptor** (not an Instance): `{ when: () => unknown; children: () => Instance }`.
- `SwitchProps { children: MatchDescriptor | MatchDescriptor[]; fallback?: () => Instance }`.
- Container: single-slot `BoxNode`. An effect picks the first descriptor whose `when()` is truthy
  (memoized on the chosen index) → build its `children` thunk in a `createRoot`; none match →
  `fallback`. Swap child, dispose the previous scope, `scheduleFrame()`. `onCleanup` disposes the active scope.

## Runtime integration

- New files under `packages/runtime/src/` (`show.ts`, `for.ts`, `index-cf.ts`, `switch.ts`), a small
  shared `reconcile-helpers.ts` if useful (e.g., building a keyed map). Export `Show`, `For`,
  `Index`, `Switch`, `Match` (+ prop types) from the runtime barrel.
- No `mount` change needed: control-flow containers are ordinary instances; their effects run under
  the mount root (created during `component()`), and their per-item `createRoot`s are disposed by
  the reconciler / `onCleanup`.

## Showcase — todo app (`examples/todo`)

New `examples/todo/{index.html,main.tsx,vite.config.ts}` (dark theme, reusing the counter's Vite
alias config). Features:
- `<Input>` to add a todo (Enter → append `{ id, text, done }`, clear).
- `<Show when={todos.length}>` with an empty-state fallback.
- `<For each={todos} key={t => t.id}>` rendering each todo as a `Row`: a clickable label
  (toggle `done` — done shows strikethrough color) + a "✕" delete button.
- A footer `Text` with "N left" (active count).
Exercises For reconciliation (add/remove/toggle), Show, Input (now working), events, styling.

## Testing

- **Show:** renders children when truthy, fallback when falsy; toggling disposes the previous
  scope (a cleanup registered in the branch runs); no rebuild when a truthy value changes without
  crossing false.
- **For:** initial render maps items in order; adding a key inserts an instance; removing a key
  disposes its scope; surviving keys keep the **same instance** across reorder; reorder updates
  `instance.children`/`flex.children` order; empty → fallback; unmount disposes all.
- **Index:** value change at an index updates in place (same instance, its item accessor yields the
  new value); grow adds slots; shrink disposes slots.
- **Switch/Match:** first truthy match renders; switching matches disposes the old scope; none →
  fallback.
- **FlexNode.mainAxisSize:** `'min'` shrink-wraps to content; `'max'` (default) fills — existing
  Flex tests still pass.
- Reconciler updates both instance children and layout children and schedules a frame (via a fake host).

## Exit criteria

- `<Show>`/`<For>`/`<Index>`/`<Switch>`/`<Match>` work with keyed reconciliation + subtree cleanup.
- `pnpm typecheck` + `pnpm vitest run` green across the workspace.
- `examples/todo` runs: add, toggle, delete, empty-state, live count (manual browser check).

## Out of scope

- `<Portal>` / overlays (needs a second render target — later phase).
- Transparent fragment-flattening (control flow stays a container node).
- Animated list transitions / FLIP (Phase 13).
- `<For>` `index` as a reactive accessor (it's a plain number at reconcile time; use `<Index>` for
  index-reactive needs).
