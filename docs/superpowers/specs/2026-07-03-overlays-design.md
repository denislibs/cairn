# Overlays (Portal / Modal / Tooltip / Popover) — Design

**Date:** 2026-07-03
**Status:** approved design
**Context:** Second feature of the post-styling infra block (after ScrollView). Cairn paints one instance tree in one pass, so overlays need a root overlay layer (paint last, hit-test first).

## Goal
`Portal` (render content on top of everything, escaping the normal tree), and `Modal` / `Tooltip` / `Popover` built on it, with an anchored positioning engine.

## 1. Portal core

### OverlayRegistry (`@cairn/runtime`)
Per-mount registry of overlay instances:
```ts
export interface OverlayRegistry {
  add(inst: Instance): number;   // returns id
  remove(id: number): void;
  list(): Instance[];            // reactive read (tracks) — current overlays in insertion order
}
export function createOverlayRegistry(): OverlayRegistry;
```
Backed by a signal holding `{id, inst}[]`; `list()` reads it (so the render/hit path tracks changes); `add`/`remove` update it → `scheduleFrame` fires via the reactive render effect (or explicitly). Provided via `overlayContext` (a reactivity context) so a deep `Portal` can reach it with `useOverlays()`.

### Portal primitive (`@cairn/primitives`)
`Portal({ children })`: on creation, `useOverlays().add(children)`; `onCleanup(() => remove(id))`. In-tree it returns a **zero-size placeholder** instance (`BoxNode {width:0,height:0}`, no paint) so it occupies no layout space where declared. The `children` instance is rendered by the overlay layer instead.

### mount integration (`@cairn/runtime`)
- Create `const overlays = createOverlayRegistry();` and build the app tree under `runWithContext(overlayContext, overlays, () => component())` (nested with the existing `hostContext`).
- A `layered()` helper returns a synthetic root: `{ layout: { offsetX:0, offsetY:0, size:{w,h} }, children: [appRoot, ...overlays.list()], paintSelf(){} , handlers:{} }` (a plain object satisfying `Instance`/`HitNode`; its layout is a light stand-in with the surface size).
- `renderFrame`: lay out `appRoot` with tight surface constraints (as today); lay out **each overlay** with loose surface constraints `{minW:0,maxW:w,minH:0,maxH:h}` (so a Modal can fill via `100%` and a Popover can size to content); `beginFrame; clear; paint(appRoot); for (o of overlays.list()) paint(o); endFrame`.
- Pointer dispatcher + focus manager `getRoot` → `layered()` (rebuilt per call; cheap). `hitTest` walks children in reverse → overlays (added later, last in array) are hit first; app root last. Focus `collectFocusables` sees overlay focusables too.
- `overlays.list()` read inside `renderFrame`/`layered` makes them reactive; changing the overlay set schedules a frame.

## 2. Positioning engine (`@cairn/primitives`)

Pure placement:
```ts
export type Side = 'top' | 'bottom' | 'left' | 'right';
export type PlaceAlign = 'start' | 'center' | 'end';
export interface Rect { x: number; y: number; width: number; height: number }
export function computePlacement(
  anchor: Rect, content: { width: number; height: number }, viewport: { w: number; h: number },
  opts: { side?: Side; align?: PlaceAlign; offset?: number; flip?: boolean },
): { x: number; y: number; side: Side };
```
Places `content` on `side` of `anchor` offset by `offset` (default 8), aligned per `align`; if `flip !== false` and it would overflow the viewport on that side, flips to the opposite side; finally clamps `x`/`y` into `[0, viewport - content]`.

Anchor rect: `getAbsRect(target: Instance, root: Instance): Rect | null` — DFS from `root` accumulating `offsetX/offsetY`; when it reaches `target`, returns `{x,y,width:target.layout.size.w,height:target.layout.size.h}`. Used to locate a trigger element's on-screen rect. `mount` exposes the current app root to widgets via the overlay context (add `appRoot(): Instance` to the registry, set by mount) so `getAbsRect(trigger, overlays.appRoot())` works after a layout pass.

## 3. Components (`@cairn/widgets`)

- **Modal** `{ open, onClose, children }`: when `open` (bool or accessor) is truthy, renders a `Portal` whose content is a full-surface `Box` (`width:'100%', height:'100%'`, `backgroundColor` dim e.g. `rgba(0,0,0,0.5)`, `alignX/alignY:'center'`) with `onClick` → `onClose` (backdrop dismiss), containing the `children` content box (its own `onClick` stops propagation so clicking content doesn't close). Escape key → `onClose` (a focusable backdrop + onKeyDown, or a key handler on the content). Renders nothing when closed.
- **Tooltip** `{ content, children }`: renders the trigger (`children`) inline; owns a `shown` signal toggled by the trigger's `onPointerEnter`/`onPointerLeave`; when shown, a `Portal` renders the tooltip bubble positioned via `computePlacement(getAbsRect(trigger, appRoot), bubbleSize, viewport, {side:'top'})` inside a full-surface `Stack` with the bubble at `left/top`.
- **Popover** `{ content, children, side? }`: renders the trigger inline; `open` signal toggled by trigger `onClick`; when open, a `Portal` renders a full-surface transparent `Box` (outside-click catcher → close) + the content positioned at the anchor (via computePlacement). Escape closes.

For Tooltip/Popover the "trigger instance" is the `children` Instance passed in — the widget holds that reference and passes it to `getAbsRect`. Content size for placement: measured after first layout, or a provided `contentWidth/Height` prop for v1 (default sensible size); document that placement uses the content's measured size once laid out (recompute next frame). Keep v1 simple: position using the content's laid-out size read on the frame after open (one-frame settle is acceptable) OR accept explicit size hints.

## Testing
- `computePlacement`: bottom/top/left/right placement math; align start/center/end; flip when overflowing; clamp into viewport.
- `getAbsRect`: nested offsets accumulate to the correct abs rect; returns null when target not in tree.
- OverlayRegistry: add returns id, list reflects adds in order, remove drops it.
- Portal: registers children on create (list length +1), placeholder is zero-size; unregister on dispose (via createRoot dispose).
- mount overlay layer: with an overlay registered, hit-testing a point over the overlay returns the overlay target (not the app content beneath); paint order paints app root then overlay.
- Modal: closed → registry empty; open → one overlay; backdrop click calls onClose; content click does not.
- Tooltip/Popover: hover/click toggles the overlay; outside-click/Escape closes Popover.
- Full `pnpm test` + `pnpm typecheck` green; no overlays → mount behaves exactly as before (app root laid out tight, painted alone).

## Exit criteria
- Portal renders on top + hit-tests first; Modal/Tooltip/Popover work; positioning with flip; verified live in a browser (open a modal, hover a tooltip, click a popover).
- Capability doc §13 `Portal / оверлеи / Modal / Tooltip / Popover` → ✅. One PR merged to `main`.

## Out of scope
Focus trap inside modal (a11y phase), open/close animations (layer later via S7 `transition`), floating-ui-level strategies (auto-placement scoring, arrow elements), scroll-repositioning of open popovers, nested Portal depth > simple stacking, backdrop blur.
