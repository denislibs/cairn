# @cairn/runtime

The runtime that turns JSX + signals into a live canvas app. SolidJS-style: components run
once and return an `Instance` (has-a layout node + `paintSelf` + children); reactivity updates
instances in place.

## Exports

- `mount(component, host)` — build the tree, do an initial layout+paint, and drive a
  coalesced full-frame re-render on every reactive change and on surface resize.
- `paint(instance, renderer)` — the paint walk (translate by relative offsets, draw, recurse).
- `bind(value, apply)` — apply a value to a sink; if it is a function it is reactive.
- `jsx`/`jsxs`/`Fragment` (also at `@cairn/runtime/jsx-runtime`) — automatic JSX runtime.
- `setFrameRequester` / `scheduleFrame` — the module frame-scheduling hook.

## JSX setup

Configure your bundler with `jsx: 'automatic'`, `jsxImportSource: '@cairn/runtime'`. Dynamic
values are passed as functions/accessors (runtime-reactive convention); a compile-time plugin
for `{count()}` sugar is a separate future lib.

## Notes

Phase 4 uses a full-frame model (any change re-lays-out + repaints the whole surface) and a
single active root. Dirty-region rendering and multi-root come later.

## Provider

`Provider({ context, value, children })` provides a context value to a subtree. Because JSX
children are evaluated eagerly, `children` is a thunk run inside the context scope:

    <Provider context={ThemeCtx} value={dark}>{() => <App />}</Provider>
