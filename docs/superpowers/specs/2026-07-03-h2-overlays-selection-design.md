# H2 — Headless overlays & selection — Design

**Date:** 2026-07-03
**Status:** approved design
**Part of:** Headless standard-library roadmap (H2). Builds on H0/H1 and the existing overlay infra.

## Goal
Overlay + selection controls in `@cairn/widgets`, headless (H0 pattern): `Popover`, `Tooltip`, `Menu` (+ `MenuItem`), `Select` (+ `Option`). Rebuild the existing ad-hoc `Popover`/`Tooltip` onto the headless pattern (default-styled, `style`-overridable, render-fn where useful) and add `Menu`/`Select`.

## Reuse (existing infra)
- `Portal` (primitives) — renders content into the overlay layer.
- `computePlacement(anchor, contentSize, viewport, {side,align,offset,flip})` + `getAbsRect(target, root)` (primitives).
- `useOverlays()` / `overlayContext` (runtime) — `appRoot()` for absolute rects.
- Overlay KEY PATTERN (from the overlays work): return the trigger INLINE; drive the Portal via `createEffect(() => { if (open()) portalContent(); })`. Do NOT wrap the trigger in a `Stack` (StackNode fills finite constraints). A full-surface transparent **catcher** Box closes on outside-click / Escape.
- `useWidgetTheme`, `createControl`, `createCompoundContext`, `mergeStyles`, `Presence` (enter/exit anim, optional).

## Components

### `Popover` (compound-ish, keep simple)
`Popover({ trigger, children (content), side?, align?, offset?, open?, defaultOpen?, onOpenChange?, style? })`. Click trigger toggles; outside-click/Escape closes (catcher). Content is a themed surface (bg surface, border, radii, shadow/elevation, padding) — overridable via `style`. Controlled/uncontrolled `open`. Placement via `computePlacement` (flip on).

### `Tooltip`
`Tooltip({ trigger, label | children, side?, delay?, style? })`. Shows on hover (enter after `delay`, hide on leave), small dark themed bubble by default. No focus steal; pointerEvents none on the bubble.

### `Menu` (compound) + `MenuItem`
`Menu({ trigger, children, side?, align?, open?, onOpenChange? })` provides a menu context (close(), active index for roving) via `createCompoundContext('Menu')`. Opens a Popover-like surface with a vertical list. `MenuItem({ onSelect, disabled?, children|label, style? })` — click/Enter → `onSelect()` + close; hover/ArrowUp/Down roving highlight; disabled skips. Default item look: padded row, hover highlight (theme), focus/active highlight.

### `Select` (compound) + `Option`
`Select({ value?, defaultValue?, onChange?, placeholder?, disabled?, children, style? })` provides a select context (`value`, `setValue`, `close`, register options) via `createCompoundContext('Select')`. Renders a trigger button (themed field frame like `Input`, shows the selected option's label or placeholder + a chevron) that opens a Menu-like listbox of `Option`s. `Option({ value, disabled?, children|label })` — selecting sets the value + closes; the currently-selected option shows a check/highlight. Keyboard: open on Enter/Space/ArrowDown; roving; Enter selects; Escape closes. Controlled/uncontrolled.

## Testing
- Popover: toggle open on trigger click; controlled open; outside-click/Escape closes; content is a Portal child when open.
- Tooltip: shows after hover (simulate enter → after delay content present), hides on leave.
- Menu/MenuItem: opening shows items; MenuItem onSelect fires + menu closes; disabled item blocked; roving highlight moves with arrows.
- Select/Option: selecting an option sets value + onChange + closes; controlled value; placeholder when empty; only one selected; keyboard open/select/close.
- `useMenu()`/`useSelect()` throw outside their roots.
- Full `pnpm test` + `pnpm typecheck` green.

## Exit criteria
- All five shipped headless, default-styled, overridable; tested.
- Browser: a page with a Popover, a Tooltip, a Menu (opens, pick an item), and a Select (opens, pick an option → trigger updates) — all positioned correctly, close on outside-click, no greedy-fill.
- README catalog updated (Popover/Tooltip/Menu/Select → ✅).
- One PR merged.

## Out of scope
Submenus, Combobox/typeahead filtering (H3), ContextMenu, virtualized long lists, multi-select (note as future), open/close animation polish (basic Presence optional).
