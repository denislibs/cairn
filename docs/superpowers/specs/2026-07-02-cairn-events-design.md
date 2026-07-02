# Cairn Phase 7a — Events: pointer + hit-testing + onClick — Design

**Date:** 2026-07-02
**Status:** approved design
**Depends on:** host, layout, runtime, primitives, platform-web (all merged to main).
**Milestone:** toward M4 (interactive UI). 7a = real clicks; hover (7b) and focus (7c) follow.

## Goal

Make Cairn interactive with pointer input: an `InputSource` platform seam, a DOM-free
`@cairn/events` package (event model + hit-testing + bubble dispatch + click synthesis),
runtime wiring, primitive event props, and a browser `WebInputSource`. Result: a canvas
element responds to real clicks via `<Box onClick={...}>`.

## Decisions

| Area | Decision |
|---|---|
| Raw input seam | `InputSource` (+ `PointerInput`/`WheelInput` types) in `@cairn/host`; added to `Host` as `input` |
| Event model | New DOM-free `@cairn/events`: `hitTest`, `dispatch`, `createPointerDispatcher`, event types |
| Propagation | Bubble-only (`target → root`); `stopPropagation()` supported; capture deferred |
| Click synthesis | Nearest-common-ancestor of the pointerdown and pointerup targets |
| Hit-test node | Structural `HitNode` (`{ layout, children, handlers? }`); runtime `Instance` conforms |
| Coordinates | Logical CSS px relative to the canvas top-left (same space as layout/paint) |
| Dispatch loop | In `runtime.mount` — subscribes to `host.input`, hit-tests `root`, dispatches |

## `@cairn/host` additions (`input.ts`)

```ts
export type PointerInputType = 'pointerdown' | 'pointermove' | 'pointerup';

export interface PointerInput {
  type: PointerInputType;
  x: number; // logical px, relative to the surface top-left
  y: number;
  button: number; // 0 = primary
  pointerType: 'mouse' | 'touch' | 'pen';
}

export interface WheelInput {
  x: number;
  y: number;
  deltaX: number;
  deltaY: number;
}

export interface InputSource {
  onPointer(cb: (e: PointerInput) => void): () => void; // returns unsubscribe
  onWheel(cb: (e: WheelInput) => void): () => void; // returns unsubscribe
}
```

`Host` gains `input: InputSource`.

## `@cairn/events`

### Event types (`event.ts`)
```ts
export interface HitNode {
  layout: { offsetX: number; offsetY: number; size: { w: number; h: number } };
  children: HitNode[];
  handlers?: EventHandlers;
}

export interface CairnPointerEvent {
  type: 'pointerdown' | 'pointermove' | 'pointerup' | 'click';
  x: number;
  y: number;
  button: number;
  pointerType: 'mouse' | 'touch' | 'pen';
  target: HitNode;
  stopPropagation(): void;
}

export interface CairnWheelEvent {
  x: number;
  y: number;
  deltaX: number;
  deltaY: number;
  target: HitNode;
  stopPropagation(): void;
}

export interface EventHandlers {
  onPointerDown?(e: CairnPointerEvent): void;
  onPointerMove?(e: CairnPointerEvent): void;
  onPointerUp?(e: CairnPointerEvent): void;
  onClick?(e: CairnPointerEvent): void;
  onWheel?(e: CairnWheelEvent): void;
}
```

`Instance` (runtime) structurally satisfies `HitNode` once it carries `handlers?`.

### hitTest (`hit-test.ts`)
```ts
export function hitTest(root: HitNode, x: number, y: number): HitNode[];
```
- Walk from root, accumulating absolute offset (`ax += node.layout.offsetX`, etc.).
- A node is hit if `x,y` is within `[ax, ax+w) × [ay, ay+h)`.
- Descend only when the point is inside the node; check children in **reverse order**
  (later-painted on top); the first child subtree that captures the point wins.
- Return the path `[target, …ancestors, root]` (bubble order). Empty array if the root
  itself is not hit.
- v1 limitation: children overflowing the parent's box are not hit (descent is gated by the
  parent bounds).

### dispatch (`dispatch.ts`)
```ts
export function dispatch(
  path: HitNode[],
  event: Omit<CairnPointerEvent, 'target' | 'stopPropagation'>,
): void;
```
- Build a single event object with `target = path[0]` and a `stopPropagation()` closure.
- Iterate `path` in order (`target → root`), calling the matching handler
  (`onPointerDown`/`onPointerMove`/`onPointerUp`/`onClick`), stopping if `stopPropagation` was called.
- A wheel variant `dispatchWheel(path, wheelEvent)` handles `onWheel`.

### createPointerDispatcher (`pointer-dispatcher.ts`)
```ts
export function createPointerDispatcher(getRoot: () => HitNode): {
  handlePointer(input: PointerInput): void;
  handleWheel(input: WheelInput): void;
};
```
- `handlePointer`: `path = hitTest(getRoot(), x, y)`; if empty, return. Dispatch the
  pointer event along `path`. On `pointerdown`, remember `downPath`. On `pointerup`, compute
  the nearest common ancestor of `downPath` and the current `path`; if found, dispatch a
  `click` event bubbling from that ancestor up to root; then clear `downPath`.
- `handleWheel`: hit-test + `dispatchWheel`.
- Nearest common ancestor: the deepest node present in both `downPath` and the up `path`
  (both end at root, so one always exists when both are non-empty).

## Runtime integration

- `Instance` gains `handlers?: EventHandlers`.
- `mount`: after building `root`, create a pointer dispatcher (`getRoot = () => root`) and
  subscribe: `host.input.onPointer(d.handlePointer)` and `host.input.onWheel(d.handleWheel)`.
  The `dispose` returned by mount unsubscribes both. Handlers that mutate signals repaint via
  the existing scheduler — no special frame handling.

## Primitives

- `Box`/`Text`/`Row`/`Column` accept `onClick`/`onPointerDown`/`onPointerMove`/`onPointerUp`/
  `onWheel` props. A small `collectHandlers(props)` builds an `EventHandlers` object (only the
  provided ones) and sets it on the returned `Instance.handlers` (omitted if none provided).

## platform-web

- `WebInputSource(canvas)`: attaches `pointerdown`/`pointermove`/`pointerup`/`wheel` listeners
  to the canvas; converts to logical coordinates (`x = clientX − rect.left`,
  `y = clientY − rect.top` using `canvas.getBoundingClientRect()`); maps `button`/`pointerType`;
  fans out to subscribers; each `on*` returns an unsubscribe.
- `createWebHost` adds `input: new WebInputSource(canvas)` to the returned `Host`.

## Example

Update `examples/counter/main.tsx`: replace the temporary `canvas.addEventListener('click', …)`
with a real `Box` button carrying `onClick={() => setCount(count() + 1)}`.

## Testing

- **@cairn/events:**
  - `hitTest`: point in a nested tree returns the correct `[target … root]` path; the topmost
    (later) overlapping sibling wins; a miss returns `[]`.
  - `dispatch`: handlers fire in bubble order; `stopPropagation()` halts.
  - nearest-common-ancestor helper: correct deepest shared node.
  - `createPointerDispatcher`: down+up on the same target → click on it; down and up in
    different subtrees → click on their common ancestor; pointerup with no matching down → no click.
  - wheel dispatch.
- **@cairn/host:** `InputSource` is implementable (conformance stub).
- **platform-web:** `WebInputSource` with a fake canvas + synthetic DOM events → normalized
  `PointerInput` (coordinate conversion via a stubbed `getBoundingClientRect`); unsubscribe stops delivery.
- **runtime:** `mount` wires `host.input` → dispatch: a pointerdown at a position hitting an
  instance with `onPointerDown` calls it; a down+up synthesizes a click.
- **primitives:** `onClick` (and friends) props populate `instance.handlers`.

## Exit criteria

- `@cairn/events` (hit-test + bubble dispatch + NCA click) built DOM-free; `InputSource` in host
  + `WebInputSource` in platform-web; runtime dispatch loop; primitive event props.
- `pnpm typecheck` + `pnpm vitest run` green across the workspace.
- `examples/counter` increments via a real `<Box onClick>` (manual browser check).

## Out of scope (7b/7c and later)

- Hover state + reactive restyle (7b); focus/Tab/focus-ring/keyboard (7c).
- Capture phase, pointer capture / drag, overflow-aware hit-testing, multi-touch gestures.
