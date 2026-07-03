# NF1 — Native-behavior foundation — Implementation Plan

> REQUIRED SUB-SKILL: superpowers:subagent-driven-development. TDD: failing test first.

**Goal:** extend the a11y bridge for all roles + declarative native-behavior hooks, add a reusable toolkit in `@cairn/widgets`, finish `createControl` fidelity.

Design: `docs/superpowers/specs/2026-07-04-nf-native-foundation-design.md`. Builds on SA1.

**Read first:** `packages/host/src/accessibility.ts` (`SemanticsNodeData`, `AccessibilityBridge`), `packages/runtime/src/semantics.ts` (`SemanticsNode` + `collectSemantics`), `packages/platform-web/src/web-accessibility.ts` (`WebAccessibilityBridge`), `packages/widgets/src/control.ts`, `packages/widgets/src/index.ts`, `packages/platform-web/test/web-accessibility.test.ts` (jsdom harness).

---

### Task 1: new semantics hooks (host + runtime)
- `@cairn/host` `accessibility.ts`: add to `SemanticsNodeData`: `onKeyDown?: (key: string, mods: { shift: boolean; ctrl: boolean; alt: boolean; meta: boolean }) => boolean` and `autoFocus?: boolean`. Add to `AccessibilityBridge`: `focus(id: number): void` and `announce(message: string, assertive?: boolean): void`.
- `@cairn/runtime` `semantics.ts`: mirror `onKeyDown?` and `autoFocus?` on `SemanticsNode`; copy them through in `collectSemantics` (like the other optional fields).
- Tests: `collectSemantics` carries `onKeyDown`/`autoFocus`.
- Commit: `feat(host/runtime): semantics onKeyDown + autoFocus hooks; bridge focus()/announce()`.

### Task 2: bridge — all-role keyboard, onKeyDown forwarding, autoFocus, announce (platform-web)
- `web-accessibility.ts`:
  - **Non-button activation**: for focusable roles that are NOT `<button>` (checkbox/radio/switch/option/menuitem/tab/slider — i.e. the `<div role>`/`<a>` elements), add a `keydown` listener: on `Enter` → `onActivate?.()`; on `Space` → preventDefault + `onActivate?.()`. (`<button>` already fires click on Enter/Space natively — don't double-handle it; only add this for non-button elements.)
  - **onKeyDown forward**: on every element's `keydown`, call `getState()?.node.onKeyDown?.(e.key, {shift,ctrl,alt,meta})`; if it returns true, `e.preventDefault()`. (Do this before/around the activation handling; if onKeyDown handled it, skip activation.)
  - **autoFocus**: track `lastAutoFocusId`. After reconciling in `sync`, find the node with `autoFocus === true`; if its id !== lastAutoFocusId, `el.focus()` and set lastAutoFocusId; if no node has autoFocus, reset lastAutoFocusId to null. (Edge-triggered — don't refocus every frame.)
  - **focus(id)**: `this.elementMap.get(id)?.el.focus()`.
  - **announce(message, assertive?)**: lazily create two visually-hidden `aria-live` region divs (polite + assertive) inside the container (position:absolute; width:1px;height:1px;overflow:hidden; clip); set the chosen region's `textContent = ''` then (next microtask/tick) to `message` so repeated identical messages re-announce. Keep it simple + jsdom-safe.
- Tests (jsdom): checkbox `<div role=checkbox>` keydown Space → onActivate + preventDefault; onKeyDown returning true → preventDefault called; a node with autoFocus gets focused after sync, and is NOT re-focused on a second identical sync; `focus(id)` focuses; `announce('x')` sets aria-live region text.
- Commit: `feat(platform-web): bridge — non-button key activation, onKeyDown, autoFocus, focus(), announce()`.

### Task 3: toolkit — roving, typeahead, announce, keys (widgets)
- `packages/widgets/src/native/keys.ts`: exported key constants (`ARROW_UP/DOWN/LEFT/RIGHT`, `HOME`, `END`, `ESCAPE`, `ENTER`, `SPACE`, `PAGE_UP/DOWN`) and small predicates.
- `packages/widgets/src/native/roving.ts`: `createRoving({ count: Accessor<number>, orientation?: 'vertical'|'horizontal'|'both', loop?: boolean, initial?: number })` → `{ active: Accessor<number>, setActive, handleKey: (key: string) => boolean }`. handleKey moves active on the matching arrows/Home/End (respecting orientation + loop), returns true if it handled the key. Pure logic (signals only).
- `packages/widgets/src/native/typeahead.ts`: `createTypeahead({ getLabels: () => string[], onMatch: (i: number) => void, timeoutMs? })` → `{ handleChar: (ch: string) => boolean }` (buffers printable chars, matches a case-insensitive prefix among labels, calls onMatch, returns handled). For the reset timer use the host scheduler if available else a monotonic counter passed via `now?: () => number` option defaulting to a simple incrementing fallback — DO NOT call Date.now() directly (banned in DOM-free packages); accept a `now` injector, tests pass a fake clock.
- `packages/widgets/src/native/announce.ts`: `useAnnounce()` → reads `useHost()` (guard) and returns `(msg, assertive?) => host.a11y?.announce(msg, assertive)`.
- Export all from `packages/widgets/src/index.ts` (namespaced or flat — flat is fine).
- Tests: roving arrow/home/end/loop/orientation; typeahead prefix match + buffer reset via fake clock; keys predicates.
- Commit: `feat(widgets): native toolkit — roving tabindex, typeahead, announce, key helpers`.

### Task 4: `createControl` fidelity (widgets)
- pointer-capture: track the element the pointerdown started on; `onClick` (canvas path) only activates if the up/click corresponds (keep it simple: pressed set on down, cleared on up/leave; already close — ensure leave doesn't permanently block a re-enter+up click). Keep existing tests green.
- Space-on-keyup / Enter-on-keydown for the fallback (no-a11y) keyboard path: Enter → activate on keydown; Space → activate on keyUP (and preventDefault on keydown). (This is the fallback; with a11y the bridge handles it.)
- Tests: Enter activates on keydown; Space activates on keyup not keydown; right-click guard (existing).
- Commit: `feat(widgets): createControl fidelity — pointer-capture + Space-on-keyup/Enter-on-keydown`.

---

## Self-review
- All native behavior is declared on SemanticsNode (onActivate/onKeyDown/autoFocus/state) → no id-plumbing; components use the toolkit to compute those.
- Bridge stays the only DOM-materializer; toolkit is pure logic + host-seam announce.
- focus-trap full impl deferred to Dialog (H4); NF1 ships focus()/autoFocus/onKeyDown primitives it will use.
- After NF1: NF2 retrofits form controls, NF3 overlays/Input, then H3+ born native.
