# AN3 — Enter/Exit presence — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Steps use `- [ ]`.

**Goal:** `Presence` control-flow component that animates enter/exit and defers unmount until exit completes.

Design ref: `docs/superpowers/specs/2026-07-03-an3-presence-design.md`.

**Tech Stack:** TypeScript, pnpm workspace, Vitest. Packages: primitives.

---

### Task 1: `Presence` component
- Files: new `packages/primitives/src/presence.ts` (`Presence`, `PresenceProps`), export from `packages/primitives/src/index.ts`. Test `packages/primitives/test/presence.test.ts`.
- Model on `packages/runtime/src/show.ts` (read it): container `Instance` with `BoxNode`, `setChild(child)` mutating `instance.children`/`layout.children` + `scheduleFrame`. Imports: `createSignal, createEffect, createMemo, createRoot, onCleanup, untrack` from `@cairn/reactivity`, `animate` from `@cairn/runtime`, `Box` from `./box`, `type BaseStyle`/easing types from `@cairn/style`, `scheduleFrame` from `@cairn/runtime`.
- State: `mounted` (child scope alive), `hidden` signal. `from = props.from ?? { opacity: 0 }`. transition object `t = props.spring ? { spring: props.spring } : { duration: props.duration ?? 250, easing: props.easing }`.
- Effect on `!!props.when()`:
  - true & not mounted: build child scope via `untrack(() => createRoot(d => { built = props.children(); scope = d; }))`; set `hidden` true (via signal) BEFORE building the wrapper; build `wrapper = Box({ style: () => ({ ...(hiddenGet() ? from : {}), transition: t }), children: built })`; `setChild(wrapper)`; then set `hiddenSet(false)` (triggers enter tween). Mark mounted.
  - false & mounted: cancel any pending unmount timer; `hiddenSet(true)` (exit tween); start `unmountCancel = animate({ from:0, to:1, duration: props.duration ?? (props.spring ? 500 : 250), onUpdate: () => {}, onDone: () => { scope?.(); scope=null; setChild(null); mounted=false; } })`.
  - true & mounted & currently exiting: cancel unmount timer, `hiddenSet(false)` (re-enter).
- `onCleanup`: cancel timer + dispose scope.
- Careful: the wrapper's `style` is a FUNCTION reading `hiddenGet()` so it's reactive. `createStyleTransitions` (via Box) seeds from the first resolved value (hidden delta) then tweens when `hidden` flips.
- TDD (fake manual-clock host + `runWithContext(hostContext, host, ...)`, like `packages/primitives/test/transitions.test.ts`):
  - `when` true initially → `presence.children.length === 1`.
  - toggle `when`→false → still `1` immediately (not removed); drive clock past duration (e.g. 300ms of ticks) → `0`.
  - toggle false→true mid-exit (before duration elapses) → stays `1` after driving clock (unmount cancelled).
  - Assert `hidden` behavior indirectly: after enter, the wrapper exists; keep assertions on children count + no throw. (Timer via animate needs the host; the fake clock drives onDone.)

### Task 2: doc + example + verify
- Update `docs/styling-and-capabilities.md` §8: enter/exit (появление/удаление) → ✅ via `Presence` (FLIP-списки still ❌/AN4). Add `Presence` to the primitives snapshot.
- Extend `examples/anim` (or add a section): a `Presence({ when: shown, from: { opacity: 0, transform: { translateY: 20 } }, duration: 260, children: () => <a card Box> })` toggled by a Button — card fades+slides in on show, out on hide. Build with vite; verify live in a browser (Playwright): toggling shows the exit animation before the element disappears (capture mid-exit). Screenshot.
- Full `pnpm test` + `pnpm typecheck` green.

---

## Self-review
- Coverage: Presence (T1), doc+example (T2).
- Reuses AN1 (Box transition) + AN2 (spring) — wrapper style animates; Presence only manages mount/keep/unmount timing.
- Risk: enter requires the wrapper to seed hidden then flip — verify createStyleTransitions seeds from the initial (hidden) resolved value so the enter tween fires. Interrupt handling cancels the timer.
