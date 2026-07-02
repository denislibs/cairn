# Cairn Phase 7c — Focus + Tab + Keyboard — Design

**Date:** 2026-07-02
**Status:** approved design
**Depends on:** style (6), events (7a), hover/restyle (7b) — all merged to main.
**Milestone:** completes M4 (interactive UI).

## Goal

Add keyboard interactivity and focus management: a keyboard input seam, a focus manager
(click-to-focus, Tab/Shift+Tab traversal, blur-on-empty), keyboard event delivery to the
focused element, and a live `focus` style variant. Builds directly on the 7b restyle
machinery — a `focus:` variant activates exactly like `hover`/`pressed`.

## Decisions

| Area | Decision |
|---|---|
| Focusable declaration | boolean `focusable?: boolean` prop; Tab order = tree order (DFS pre-order). Numeric `tabIndex` deferred |
| Keyboard target | The canvas element with `tabIndex = 0` — focus is scoped to the app surface, not global `window` |
| Focus ring | Driven by the `focus:` style variant (consistent with hover/pressed). No separate built-in ring |
| Keyboard delivery | Key events bubble from the focused node to the root (`onKeyDown`/`onKeyUp`) |
| Focus/blur | Non-bubbling synthetic `onFocus`/`onBlur` (via `dispatchTo`), like enter/leave |
| Click-to-focus | pointerdown focuses the nearest focusable in the hit path; clicking a non-focusable area blurs |
| Tab handling | `Tab`/`Shift+Tab` moves focus in tree order (wrapping) and calls `preventDefault()` so the browser keeps focus on the canvas |
| preventDefault | `KeyboardInput.preventDefault()` synchronously calls the DOM event's `preventDefault` (onKey runs inside the DOM handler) |

## Data flow

```
DOM keydown/keyup (canvas, tabindex=0) → WebInputSource → KeyboardInput → host.input.onKey
                                                                                ▼
                                                                 FocusManager.handleKey
                                                Tab/Shift+Tab? → move focus + input.preventDefault()
                                                else → dispatchKey bubbling focused → root
pointerdown (7a) → dispatcher onPointerDown hook → FocusManager.focusFromPointer(path)
                                                nearest focusable in path → focus (else blur)
                                                            ▼
                            synthetic focus/blur → primitive focused signal → 'focus' state → restyle
```

## Keyboard seam (`@cairn/host`, `input.ts`)

```ts
export type KeyInputType = 'keydown' | 'keyup';

export interface KeyboardInput {
  type: KeyInputType;
  key: string;   // 'Tab', 'Enter', 'a', 'ArrowDown'
  code: string;  // physical: 'KeyA', 'Tab'
  shift: boolean;
  ctrl: boolean;
  alt: boolean;
  meta: boolean;
  preventDefault(): void; // synchronously calls the DOM event's preventDefault
}
```
`InputSource` gains `onKey(cb: (e: KeyboardInput) => void): () => void`.

## `@cairn/events`

### Event model (`event.ts`)
- `HitNode` gains `focusable?: boolean`.
- New `CairnKeyboardEvent`: `{ type: 'keydown' | 'keyup'; key; code; shift; ctrl; alt; meta; target: HitNode; stopPropagation(): void; preventDefault(): void }`.
- New `CairnFocusEvent`: `{ target: HitNode }` (minimal — focus/blur carry no coordinates).
- `EventHandlers` gains `onKeyDown?`, `onKeyUp?` (`CairnKeyboardEvent`), `onFocus?`, `onBlur?` (`CairnFocusEvent`).

### Dispatch (`dispatch.ts`)
- Add `dispatchKey(path, init)` — bubbling dispatch mapping `keydown → onKeyDown`, `keyup → onKeyUp`, with `stopPropagation`. `init` carries the `preventDefault` from the raw input; the built event exposes it so handlers can suppress the browser default.

### Focus enumeration (`focus.ts`)
- `collectFocusables(root: HitNode): { node: HitNode; path: HitNode[] }[]` — DFS pre-order; each focusable node paired with its `[node…root]` bubble path.

### Focus manager (`focus.ts`)
```ts
export interface FocusManager {
  focused(): HitNode | null;
  blur(): void;
  focusFromPointer(path: HitNode[]): void;
  handleKey(input: KeyboardInput): void;
}
export function createFocusManager(getRoot: () => HitNode): FocusManager;
```
- Tracks `focusedPath: HitNode[] | null`.
- `focus(path)`: if `path[0]` equals the current focused node, no-op. Otherwise `dispatchTo(oldFocused, onBlur)`, set `focusedPath = path`, `dispatchTo(path[0], onFocus)`.
- `blur()`: if focused, `dispatchTo(focused, onBlur)` and clear `focusedPath`.
- `focusFromPointer(path)`: scan `path` (target→root) for the first `focusable` node; if found, `focus(path.slice(index))`; else `blur()`.
- `handleKey(input)`:
  - `keydown` + `key === 'Tab'`: `input.preventDefault()`; `list = collectFocusables(getRoot())`; if empty, return. Find the current focused node's index in `list`; `next = shift ? index-1 : index+1` (wrap modulo length; when nothing is focused, start at first for Tab / last for Shift+Tab); `focus(list[next].path)`.
  - otherwise: if `focusedPath`, `dispatchKey(focusedPath, { type: input.type, key, code, modifiers, preventDefault: input.preventDefault })`.

## `@cairn/primitives`

- Box/Text/Row/Column props gain `focusable?: boolean`; the returned `Instance` carries `focusable`.
- `EventProps` gains `onKeyDown?`/`onKeyUp?` (`CairnKeyboardEvent`) and `onFocus?`/`onBlur?` (`CairnFocusEvent`).
- `createInteractive` gains a `focused` signal: `onFocus` → `setFocused(true)` + user; `onBlur` → `setFocused(false)` + user; `'focus'` pushed to `activeStates` when focused. `onKeyDown`/`onKeyUp` passed through to the user's handlers.

## `@cairn/runtime`

- `Instance` gains `focusable?: boolean` (so it structurally satisfies the extended `HitNode`).
- `createPointerDispatcher(getRoot, hooks?)` gains an optional `hooks.onPointerDown(path: HitNode[])`, invoked on every `pointerdown` (including an empty path, so clicking empty space can blur). Called after `syncHover`, before the empty-path early return.
- `mount`: create `createFocusManager(() => root)`; wire `host.input.onKey(e => focus.handleKey(e))`; pass `{ onPointerDown: (path) => focus.focusFromPointer(path) }` to `createPointerDispatcher`. Unsubscribe the key listener on dispose.

## `@cairn/platform-web`

- `WebInputSource`: in the constructor set `canvas.tabIndex = 0` (only if not already set) so the canvas can receive keyboard focus; add `keydown`/`keyup` listeners; emit `KeyboardInput` mapping `key`/`code`/`shiftKey`/`ctrlKey`/`altKey`/`metaKey` with `preventDefault: () => ev.preventDefault()`; fan out to key subscribers. `onKey` returns an unsubscribe; `dispose()` removes the two listeners.

## Example (M4 finale)

`examples/counter/main.tsx`: make the button `focusable` with a `focus:` variant, and add
`onKeyDown` so **Enter** or **Space** increments — a fully pointer- and keyboard-operable button.

## Testing

- **host:** `KeyboardInput`/`onKey` implementable (conformance stub); `preventDefault` is callable.
- **events:**
  - `collectFocusables`: pre-order list with correct paths; skips non-focusable; nested focusables.
  - `focusFromPointer`: focuses nearest focusable ancestor in the path; blurs when the path has none.
  - focus/blur: `onFocus` on the new node, `onBlur` on the old; re-focusing the same node is a no-op.
  - Tab: cycles focusables in tree order, wraps at the end; Shift+Tab reverses; with nothing focused, Tab focuses the first; `Tab` calls `input.preventDefault()`.
  - `dispatchKey`: keydown bubbles focused→root, maps to `onKeyDown`; `stopPropagation` halts; `preventDefault` forwards.
- **primitives:** `focusable` sets `Instance.focusable`; `onFocus`/`onBlur` flip the `focus` variant (resolved style changes); `onKeyDown` prop fires.
- **platform-web:** synthetic `keydown` → normalized `KeyboardInput` (key/code/modifiers); `preventDefault` hook calls the DOM `preventDefault`; `tabIndex` set on the canvas.
- **runtime:** `mount` routes `onKey` to the focus manager (a focused node with `onKeyDown` receives a key); a `pointerdown` over a focusable focuses it.

## Exit criteria

- Click-to-focus, Tab/Shift+Tab traversal, and keyboard events to the focused element all work.
- `focus` style variant activates live on focus.
- `pnpm typecheck` + `pnpm vitest run` green across the workspace.
- Counter button is operable by mouse AND keyboard (Tab to it, Enter/Space to increment) — manual browser check. **M4 complete.**

## Out of scope (later phases)

- Numeric `tabIndex` ordering, focus traps/scopes, auto-focus, `disabled` skipping focus.
- Text input, caret, IME/composition (Phase 8).
- Arrow-key roving tabindex, screen-reader focus mirroring (Phase 14 a11y).
