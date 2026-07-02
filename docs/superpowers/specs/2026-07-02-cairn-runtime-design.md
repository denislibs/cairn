# Cairn Phase 4 — Runtime + JSX + reactive binding (`@cairn/runtime` + `@cairn/primitives`) — Design

**Date:** 2026-07-02
**Status:** approved design
**Depends on:** Phase 1 (`@cairn/reactivity`), Phase 2 (`@cairn/host`), Phase 3 (`@cairn/layout`) — all merged to main.
**Milestone:** M3 — first working reactive app (a counter) rendered to canvas.

## Goal

Tie reactivity + layout + rendering into a live application: a runtime that builds an
instance tree from JSX, binds signals to it reactively, and drives full-frame re-layout +
repaint through the Host. Ship `Box`/`Text`/`Row`/`Column` primitives and a `mount` entry point.

## Decisions

| Area | Decision |
|---|---|
| Component model | SolidJS-style: component functions run once and return an `Instance`; reactivity updates instances in place (no re-run, no VDOM diff) |
| Reactive JSX | Runtime convention: function/accessor-valued props & children are reactive (wrapped in effects). No custom compiler. The pretty auto-reactive `{count()}` is deferred to a **separate `@cairn/vite-plugin` (babel transform)** in a later phase |
| Frame model | Full-frame, coalesced: any change schedules one rAF frame → re-layout from root + clear + full paint. Dirty-region deferred to Phase 12 |
| M3 interaction | Temporary raw `canvas.addEventListener('click')` in the example (framework events are Phase 7) |
| Instance model | `Instance` **has-a** `LayoutNode` + a `paintSelf(renderer)` + `children: Instance[]` |
| Box children | Single child (multi-child → `Row`/`Column`/`Stack`) |
| Styling | Minimal inline `style` object (layout + a few paint props). Full `StyleSheet`/theme is Phase 6 |
| Roots | Single active root in Phase 4 (module-scoped scheduler hook); multi-root deferred |
| Root constraints | Tight = surface size (full-screen container; center via Flex justify/align) |
| Packages | `@cairn/runtime` (instance/jsx/binding/scheduler/paint/mount) + `@cairn/primitives` (Box/Text/Row/Column). Both DOM-free core |

## Instance model (`@cairn/runtime`)

```ts
import type { Renderer } from '@cairn/host';
import type { LayoutNode } from '@cairn/layout';

export interface Instance {
  layout: LayoutNode;             // geometry
  paintSelf(r: Renderer): void;   // own visuals, drawn in local coords ((0,0) = own top-left)
  children: Instance[];
}
```

A container primitive links its layout children: `this.layout.children = children.map(c => c.layout)`
so the layout pass recurses over the same structure. Paint walks the instance tree:

```ts
export function paint(inst: Instance, r: Renderer): void {
  r.save();
  r.translate(inst.layout.offsetX, inst.layout.offsetY);
  inst.paintSelf(r);            // draws using inst.layout.size from (0,0)
  for (const c of inst.children) paint(c, r);
  r.restore();
}
```

## JSX runtime (`@cairn/runtime/jsx-runtime`)

All elements are functions (primitives and user components); there are no lowercase host tags.
So the runtime is trivial:

```ts
export function jsx(type: (props: any) => Instance, props: any): Instance {
  return type(props);
}
export const jsxs = jsx;
export function Fragment(props: { children?: unknown }): unknown {
  return props.children; // array of children / passthrough
}
```

Vite/esbuild config in consumers: `jsx: 'automatic'`, `jsxImportSource: '@cairn/runtime'`.
Children arrive via `props.children` per the automatic runtime.

## Reactive binding (`reactive-props.ts`)

A prop or child that is a **function** is reactive; anything else is static.

```ts
// Bind a reactive value to a sink, re-running on dependency change and scheduling a frame.
export function bind<T>(value: T | (() => T), apply: (v: T) => void): void {
  if (typeof value === 'function') {
    createEffect(() => {
      apply((value as () => T)());
      scheduleFrame();
    });
  } else {
    apply(value);
  }
}
```

Primitives use `bind` for their dynamic props/children (e.g. Text content). The initial effect
run applies the value; later signal changes re-apply and schedule a frame.

## Scheduler (`scheduler.ts`)

Module-scoped (single active root in Phase 4):

```ts
let requestFrame: (() => void) | null = null;
export function setFrameRequester(fn: (() => void) | null): void { requestFrame = fn; }
export function scheduleFrame(): void { requestFrame?.(); }
```

`mount` installs a coalescing requester over `host.scheduler`:

```ts
let frameScheduled = false;
setFrameRequester(() => {
  if (frameScheduled) return;
  frameScheduled = true;
  host.scheduler.requestFrame(() => { frameScheduled = false; renderFrame(); });
});
```

## mount (`mount.ts`)

```ts
export function mount(component: () => Instance, host: Host): () => void {
  return createRoot((dispose) => {
    const ctx: LayoutContext = { measureText: (t, s) => host.renderer.measureText(t, s) };
    let root: Instance;
    const renderFrame = () => {
      const w = host.metrics.width;
      const h = host.metrics.height;
      root.layout.layout({ minW: w, maxW: w, minH: h, maxH: h }, ctx); // tight = surface
      host.renderer.beginFrame();
      host.renderer.clear();
      paint(root, host.renderer);
      host.renderer.endFrame();
    };
    root = component();      // build instance tree; reactive effects run initially
    renderFrame();           // initial layout + paint
    // Install the coalescing frame requester AFTER the initial render, so the binding
    // effects' initial scheduleFrame() calls no-op (avoids a redundant first frame).
    installRequester(host, renderFrame);
    const unsub = host.metrics.onResize(renderFrame);
    return () => { unsub(); setFrameRequester(null); dispose(); };
  });
}
```

(The `installRequester` helper wires `setFrameRequester` + `frameScheduled` as shown in Scheduler.)

## Primitives (`@cairn/primitives`) — minimal inline style

Style is a plain object; only the properties below are honored in Phase 4:
- **Box**: `width`, `height`, `padding` → `BoxNode`; `backgroundColor`, `borderRadius` → paint.
  Single optional child. `paintSelf`: if `backgroundColor`, `fillRoundRect({0,0,w,h}, borderRadius ?? 0, {color})`.
- **Text**: content = `string | number | (() => string | number)`; `font`, `color` → paint.
  `TextNode` for layout; content bound via `bind`. `paintSelf`: `drawText(text, {x:0,y:0}, {font, color, baseline:'top'})`.
- **Row** / **Column**: `children[]`, `gap`, `justify`, `align` → `FlexNode` (direction row/column).
  No own visuals.

In Phase 4 only **content** is reactive (Text's children/value via `bind`). Reactive *style*
props (function-valued `backgroundColor`, `font`, sizes, etc.) are a follow-up — style is read
once at construction for now. This keeps M3 focused (the counter only animates text).

## Data flow (one change)

```
signal set → binding effect re-runs → mutates instance's layout/paint field → scheduleFrame()
  → host.scheduler.requestFrame (coalesced) → renderFrame(): re-layout(surface) + clear + paint
```

## Testing (headless)

A fake `Host`:
- recording `Renderer` (records method calls + args; `measureText` deterministic),
- `FrameScheduler` that **captures** the callback so tests flush a frame manually,
- `SurfaceMetrics` with settable size + `onResize`.

Assertions:
- `mount` builds the instance tree and performs an initial paint (renderer calls in order).
- A signal change requests exactly one frame; flushing it repaints with the new value.
- Multiple signal changes in a tick coalesce into one frame.
- Primitives produce the correct layout nodes (padding/gap/direction) and paint calls
  (background rect, text draw with font/color).
- `bind`: static value applied once; function value re-applies on change.

`examples/counter/` is browser-only (manual M3 check): a centered card, title + reactive count,
incremented by a temporary `canvas` click listener.

## Exit criteria

- `@cairn/runtime` + `@cairn/primitives` build DOM-free; `pnpm typecheck` + `pnpm vitest run` green.
- Instance tree + JSX runtime + reactive `bind` + coalescing scheduler + paint walk + `mount` implemented.
- Box/Text/Row/Column produce correct layout + paint under the fake host.
- **M3:** `examples/counter` renders a reactive counter to canvas and updates on click (manual).

## Out of scope (later phases)

- Compile-time reactive JSX plugin `@cairn/vite-plugin` (new roadmap item, separate lib).
- Events / hit-testing / real `onClick` (Phase 7).
- Control flow `<Show>`/`<For>` (Phase 9).
- Full `StyleSheet` + states + theme (Phase 6).
- Dirty-region rendering, multi-root (Phase 12).
