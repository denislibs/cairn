# AN3 — Enter/Exit presence (`Presence`) — Design

**Date:** 2026-07-03
**Status:** approved design
**Part of:** Animations v2 + SVG roadmap (AN3).

## Goal
Animate elements appearing and disappearing. `Show`/`For` dispose instantly; `Presence` keeps a conditional child mounted through its exit animation, then removes it — and animates it in on enter.

## Approach
A single-slot control-flow container `Presence({ when, children, from?, duration?, easing?, spring? })` (in `@cairn/primitives`), modeled on `Show` (build child in a `createRoot` scope; manage `instance.children`/`layout.children`; `scheduleFrame` on change) but with delayed unmount:
- `from`: the "hidden" style delta applied at enter-start and exit-end (default `{ opacity: 0 }`; e.g. `{ opacity: 0, transform: { translateY: 16 } }`).
- The child is wrapped in a `Box` whose reactive style is `() => ({ ...(hidden() ? from : {}), transition })`. Because `Box` routes through `createStyleTransitions` (AN1), the wrapper animates between hidden and present. `transition` = `{ duration, easing }` or `{ spring }` (AN2).

### Lifecycle
- **enter** (`when` → truthy, not mounted): build the child scope; create the wrapper with `hidden=true` (so `createStyleTransitions` seeds from the hidden delta); mount it; then set `hidden=false` → the wrapper tweens `from → present`.
- **present**: `hidden=false`.
- **exit** (`when` → falsy, mounted): set `hidden=true` → wrapper tweens `present → from`; start an unmount timer via `animate({ from:0, to:1, duration, onDone })` (or the spring's settle) — on done, dispose the child scope, clear children (`gone`).
- **interrupt**: re-entering during exit cancels the pending unmount timer and sets `hidden=false` (re-enter from current position); exiting during enter cancels enter and starts exit.

Uses `useHost().scheduler` (via `animate`) for the unmount timer; `onCleanup` disposes the scope + cancels timers.

## API
```ts
export interface PresenceProps {
  when: () => unknown;
  children: () => Instance;
  from?: BaseStyle;            // hidden delta; default { opacity: 0 }
  duration?: number;           // ms; default 250 (ignored if spring)
  easing?: EasingName | EasingFn;
  spring?: { stiffness?: number; damping?: number; mass?: number };
}
export function Presence(props: PresenceProps): Instance;
```
`from` is merged into the wrapper style when hidden; the child's own styling is untouched (it's inside the wrapper). The unmount timer duration matches the transition (use `duration`, or a fixed settle window for spring, e.g. `duration ?? 500`).

## Testing
- `Presence` (fake manual-clock host): `when` initially true → child mounted (1 child). `when`→false → child STAYS mounted immediately (not removed), wrapper style goes to `from`; after driving the clock past `duration`, the child is removed (0 children). `when`→true again mid-exit → unmount timer cancelled, child stays. Enter: `when` false→true mounts with hidden then animates (wrapper style transitions).
- Because visual tweening is AN1/AN2-tested, Presence tests focus on the mount/keep/remove timing + hidden toggling.
- Full `pnpm test` + `pnpm typecheck` green.

## Exit criteria
- `Presence` animates enter + exit and defers unmount until exit completes; interrupts handled; tested.
- Live browser check: a card that fades+slides in on show and out on hide (toggle), visibly animating out before disappearing.
- Capability doc §8 FLIP/enter-exit row → enter/exit ✅ (FLIP still AN4). One PR merged.

## Out of scope
`For`-list per-item exit (AN4 FLIP covers reordering; multi-item exit staggering is AN5); shared-element transitions; exit for overlay/Modal (can wrap Modal content in Presence later).
