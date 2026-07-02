# Cairn Phase 7b — Hover + Pressed + Reactive Restyle — Design

**Date:** 2026-07-02
**Status:** approved design
**Depends on:** style (Phase 6), events (Phase 7a) — both merged to main.
**Milestone:** toward M4 (interactive UI). 7b = live hover/pressed restyle; focus (7c) follows.

## Goal

Wire live pointer state to Phase 6 style state variants: an element with a `hover`
(or `pressed`) variant restyles reactively while the pointer is over it (or pressing
it), and reverts on leave/release. This is a thin bridge between pointer events (7a)
and state-variant resolution (6); the layout and reactive engines are unchanged.

## Decisions

| Area | Decision |
|---|---|
| States in scope | `hover` and `pressed` (both pointer-driven). `focus` → 7c; `disabled`/`active` later |
| Hover tracking | Dispatcher tracks a `hoverPath`; diff on each pointer event → synthetic per-node enter/leave |
| Enter/leave semantics | Non-bubbling, CSS `:hover`-style: a parent stays hovered while the pointer is over a descendant (every node in the hit path is hovered) |
| Pressed tracking | Derived **locally** in the primitive from the bubbled `pointerdown`/`pointerup` + synthetic `pointerleave` — no dispatcher state |
| Pressed propagation | CSS `:active`-like: pressing a child also activates ancestors' `pressed` variants (because `pointerdown` bubbles). Accepted. |
| Reactive restyle | Primitive resolves style via a reactive accessor over `hovered()`/`pressed()`; `bind()` re-applies and schedules a frame on change |
| Restyle scope | Both paint AND layout props (layout-node fields are public/mutable and read at layout time) |
| Surface exit | `WebInputSource` emits an out-of-bounds `pointermove` on canvas `pointerleave` → hit-test misses → hover cleared. No `Host`/`InputSource` contract change |

## Data flow

```
pointer move ─▶ dispatcher tracks hoverPath ─▶ synthetic enter/leave (non-bubbling) ─┐
pointer down/up (bubbled, from 7a) ─────────────────────────────────────────────────┤
                                                                                     ▼
                                              primitive hovered() / pressed() signals
                                                                                     ▼
                                 resolveStyleInput(style, theme, activeStates())   [reactive]
                                                                                     ▼
                        bind() effect → write layout-node fields + stash paint props → scheduleFrame()
                                                                                     ▼
                                        full-frame re-layout + repaint with the new style
```

`resolveStyleInput(input, theme, activeStates?)` already exists (Phase 6 left the seam);
`bind(fn, apply)` already turns a function-valued input into a repaint-on-change effect.

## `@cairn/events` changes

### Event model (`event.ts`)
- `CairnPointerEvent['type']` gains `'pointerenter' | 'pointerleave'`.
- `EventHandlers` gains `onPointerEnter?(e: CairnPointerEvent)` and `onPointerLeave?(e: CairnPointerEvent)`.

### Dispatch (`dispatch.ts`)
- Add `dispatchTo(node: HitNode, init)` — **non-bubbling** single-node dispatch. Builds a
  `CairnPointerEvent` with `target = node` and invokes only that node's matching handler
  (reuses the `POINTER_HANDLERS` map, which gains `pointerenter → onPointerEnter`,
  `pointerleave → onPointerLeave`). A no-op if the node has no such handler.

### Pointer dispatcher (`pointer-dispatcher.ts`)
- Add `hoverPath: HitNode[]` state (initially `[]`).
- Add `syncHover(newPath, input)` run at the top of `handlePointer` on every pointer event:
  - Nodes in `newPath` not in the old `hoverPath` (by reference identity) → `dispatchTo(node, {type:'pointerenter', ...})`.
  - Nodes in the old `hoverPath` not in `newPath` → `dispatchTo(node, {type:'pointerleave', ...})`.
  - Set `hoverPath = newPath`. Empty `newPath` (pointer over nothing / left surface) fires
    leave for every previously-hovered node and leaves `hoverPath = []`.
- Existing bubbling dispatch + click synthesis unchanged; `syncHover` runs first.

## `@cairn/primitives` changes

### `EventProps` (`events.ts`)
- Gains `onPointerEnter?` / `onPointerLeave?`.

### New `src/interactive.ts` — `createInteractive(props)`
Given props carrying `style?: StyleInput` and the `EventProps`:
- Captures `theme = useTheme()` once (theme is stable in v1).
- Creates `[hovered, setHovered]` and `[pressed, setPressed]` signals (default `false`).
- Builds `activeStates()` → an array with `'hover'` when hovered and `'pressed'` when pressed.
- Returns:
  - `resolved: () => BaseStyle` = `resolveStyleInput(props.style, theme, activeStates())` (reactive accessor).
  - `handlers: EventHandlers | undefined` merging internal toggles with the user's handlers:
    - `onPointerEnter`: `setHovered(true)`, then `props.onPointerEnter?.(e)`.
    - `onPointerLeave`: `setHovered(false)`, `setPressed(false)`, then `props.onPointerLeave?.(e)`.
    - `onPointerDown`: `setPressed(true)`, then `props.onPointerDown?.(e)`.
    - `onPointerUp`: `setPressed(false)`, then `props.onPointerUp?.(e)`.
    - `onClick` / `onPointerMove` / `onWheel`: pass through the user's handler unchanged.
  - Handlers object is always present (interaction is always wired in 7b).

### `Box` / `Text` / `Row` / `Column`
Replace the one-shot `resolveStyleInput(...)` + `collectHandlers(...)` with `createInteractive(props)`:
- Build the layout node, then `bind(resolved, (s) => { writeLayoutFields(s); current = s; })`.
  - `bind` runs synchronously first (sets initial fields before the first layout) and re-runs
    on `hovered`/`pressed` change, scheduling a frame.
  - **Box:** write `width`/`height`/`padding` to the `BoxNode`.
  - **Text:** write `style.font` to the `TextNode`; stash `font`/`color` for paint. (Existing
    reactive-content `bind` on `value`/`children` stays.)
  - **Row/Column:** write `gap`/`justify`/`align` to the `FlexNode`.
- `paintSelf` reads the stashed `current` style instead of a captured constant.
- `handlers` = the merged handlers from `createInteractive`.

## `@cairn/platform-web` change

`WebInputSource` adds a canvas `pointerleave` listener that emits
`{ type: 'pointermove', x: -1, y: -1, button: 0, pointerType }` (out-of-bounds) so the
dispatcher's empty-path branch clears hover. (`-1,-1`, not `NaN` — NaN comparisons would
falsely read as "inside".)

## Testing

- **events:** enter fires for newly-entered nodes and leave for exited nodes on hover-path
  change; a parent stays hovered while the pointer is over its child (no spurious leave);
  moving off the tree (empty path) fires leave for all; enter/leave are non-bubbling
  (`dispatchTo` hits only the one node).
- **primitives:** hovering flips the resolved style to the `hover` variant and back;
  pressing flips `pressed`; a `pointerleave` while pressed clears `pressed`; the user's own
  `onPointerEnter`/`onPointerLeave`/`onPointerDown`/`onPointerUp` still fire; a `hover`
  variant that changes `padding` triggers re-layout (Box size changes on hover).
- **platform-web:** canvas `pointerleave` yields the out-of-bounds `pointermove` input.

## Exit criteria

- Hover and pressed state variants activate/deactivate live via pointer input.
- Restyle covers both paint and layout properties; changes repaint via the existing scheduler.
- `pnpm typecheck` + `pnpm vitest run` green across the workspace.
- Counter example: the button visibly changes on hover/press (manual browser check).

## Out of scope (7c and later)

- `focus` state, Tab order, focus ring, keyboard (7c).
- `disabled` (prop-driven) and `active` state wiring.
- Skipping interaction wiring for primitives without state variants (perf pass, Phase 12).
- Capture phase, pointer capture / drag gestures, overflow-aware hit-testing.
