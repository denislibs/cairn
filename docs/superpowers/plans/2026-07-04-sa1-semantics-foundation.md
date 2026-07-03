# SA1 — Semantics foundation + native Button — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. TDD: failing test first.

**Goal:** the semantics/accessibility layer (a hidden real-DOM mirror over the canvas) + `Button` wired end-to-end (native focus, keyboard, screen-reader role/name, focus-visible ring) + interaction fidelity in `createControl`.

Design: `docs/superpowers/specs/2026-07-04-sa-semantics-native-behavior-design.md`.

**MVP focus model (important):** each `SemanticsNode` carries callbacks `onActivate`, `onFocus(keyboard: boolean)`, `onBlur`. The bridge invokes them from real DOM events (Enter/Space/AT → native `click` → onActivate; focusin/out → onFocus/onBlur with a keyboard-vs-pointer modality flag). When `host.a11y` is present, mount does NOT run the canvas Tab focus manager (native DOM focus is authoritative — prevents double activation); the canvas pointer pipeline stays on (mouse click → component's canvas onClick → same activate). The DOM mirror is `pointer-events:none` (never steals pointer; keyboard-focusable + AT-readable).

**Read first:** `packages/runtime/src/instance.ts` (Instance fields), `packages/runtime/src/mount.ts` (frame loop + focus manager wiring — line ~74 `createFocusManager`), `packages/host/src/host.ts` + `index.ts`, `packages/platform-web/src/create-web-host.ts`, `packages/platform-web/src/web-text-input.ts` (the hidden-DOM precedent + jsdom-safe lazy document), `packages/widgets/src/control.ts` + `button.ts`, `packages/primitives/src/placement.ts` (`getAbsRect` for absolute rects).

---

### Task 1: semantics types + collection + host seam + mount wiring (`@cairn/host`, `@cairn/runtime`)
- **host** (`packages/host/src/`): new `accessibility.ts` — `SemanticsRole` (union per design), `SemanticsNodeData` (id, role, label?, value?, checked?, selected?, expanded?, disabled?, readonly?, level?, min?/max?/now?, focusable?, `rect:{x,y,width,height}`, `onActivate?`, `onFocus?:(keyboard:boolean)=>void`, `onBlur?`), `AccessibilityBridge` (`sync(nodes: SemanticsNodeData[]): void`, `dispose(): void`). Export from `packages/host/src/index.ts`. Add `a11y?: AccessibilityBridge` to `Host` (`host.ts`).
- **runtime** (`packages/runtime/src/`): new `semantics.ts` — `SemanticsNode` authoring type (role + label/value/checked/... + onActivate/onFocus/onBlur, no rect/id) ; add `semantics?: SemanticsNode` to `Instance` (`instance.ts`). `collectSemantics(root: Instance): SemanticsNodeData[]` — DFS pre-order (= tab order); for each instance with `.semantics`, emit a `SemanticsNodeData` with a **stable id** (module `WeakMap<Instance, number>` + counter) and the **absolute rect** (accumulate `layout.offsetX/offsetY` down the path; size from `layout.size`). Skip nodes with `role:'none'`. Export `SemanticsNode`, `collectSemantics` from `packages/runtime/src/index.ts`.
- **mount** (`mount.ts`): in `renderFrame`, after `flushAfterLayout()` and before/after paint, call `if (host.a11y) host.a11y.sync(collectSemantics(root))`. Wrap the focus-manager block (`createFocusManager` + its key/pointer wiring) in `if (!host.a11y) { ... }` so native focus is authoritative when a bridge exists. On dispose, call `host.a11y?.dispose()` (guarded). Keep the pointer dispatcher wiring unconditional.
- TDD (runtime): `collectSemantics` returns nodes in DFS order; each has an absolute rect (build a small tree with nested offsets and BoxNode sizes, lay it out, assert rects); the same instance keeps its id across two collect calls; a node with `role:'none'` (or no semantics) is skipped; onActivate/onFocus/onBlur are carried through. (host has no runtime, just types.)
- Commit: `feat(host/runtime): semantics layer — SemanticsNode + collectSemantics + AccessibilityBridge seam`.

### Task 2: `WebAccessibilityBridge` (`@cairn/platform-web`)
- File: `packages/platform-web/src/web-accessibility.ts`. Wire into `createWebHost` (set `a11y: new WebAccessibilityBridge(canvas)`).
- Constructor: create an overlay container `<div>` inserted as a sibling over the canvas (parent must be positioned; set container `style: position:absolute; left:0;top:0; width:100%;height:100%; pointer-events:none; overflow:hidden`). Lazy/jsdom-safe document access (mirror `web-text-input.ts`). Track input modality: listen (once, on window) `keydown`→modality='keyboard', `pointerdown`→modality='pointer'.
- `sync(nodes)`: reconcile a `Map<id, HTMLElement>` against `nodes` (keyed by id). Create missing, update existing, remove stale. Element per role: `button`→`<button>`; `checkbox`/`switch`/`radio`/`menuitem`/`option`/`slider`/`link`/`tab`→a `<div>`(or `<a>` for link) with `role=<role>`; `textbox`→skip for now (the text Input owns its own hidden input; SA3). Set: `aria-label`=label; `aria-checked`/`aria-selected`/`aria-expanded`/`aria-disabled`/`aria-readonly` when the field is defined; `aria-valuemin/valuemax/valuenow` for slider; `tabindex` = (focusable!==false && !disabled) ? '0' : '-1'; inline position `left/top/width/height` from `rect` (px); `pointer-events:none`. Re-append in `nodes` order each sync so DOM/tab order matches. Attach listeners once per element: `click`→`node.onActivate?.()` (store the current node on the element so the latest callback is used); `focus`→`node.onFocus?.(modality==='keyboard')`; `blur`→`node.onBlur?.()`. Keep a per-element reference to the latest node so callbacks aren't stale across syncs.
- `dispose()`: remove the container + window listeners.
- TDD (jsdom — vitest environment; see how other platform-web tests get a DOM, or set `// @vitest-environment jsdom`): `sync([{id:1,role:'button',label:'OK',rect,onActivate}])` creates a `<button aria-label="OK" tabindex="0">` positioned at rect; dispatching `click` calls onActivate; dispatching `focus` after a keydown calls onFocus(true), after a pointerdown onFocus(false); a second `sync` with `checked:true` on a checkbox sets `aria-checked="true"`; syncing without a previously-present id removes its element; `disabled:true` → `tabindex="-1"` + `aria-disabled="true"`.
- Commit: `feat(platform-web): WebAccessibilityBridge — hidden ARIA/DOM mirror over the canvas`.

### Task 3: `Button` native semantics + `createControl` fidelity (`@cairn/widgets`)
- `control.ts`: add a `focusVisible` signal to `createControl`; expose `focusVisible` in `ControlState`. Fidelity: pointer-capture — track the pointerdown; `pressed` set on down, cleared on up/leave; keep the existing canvas keyboard handlers (Enter/Space→onClick) for the NO-a11y fallback path. Add a right-click guard (ignore `onClick`/activation when `e.button` is set and non-zero, if available). Do not break existing tests.
- `button.ts`: set `instance.semantics = { role:'button', label: <props.label or ''>, disabled: !!props.disabled, onActivate: activate, onFocus: (kb)=>setFocusVisible(kb), onBlur: ()=>setFocusVisible(false) }` where `activate` is the existing disabled-guarded click action and `setFocusVisible` drives the ring. The default style paints the focus ring only when `focusVisible()` (function-form style reading it). Keep pointer `onClick`→activate. Update `instance.semantics.disabled`/`label` reactively if they can change (keep simple: read at build; disabled from props).
- TDD: Button instance has `.semantics` with `role:'button'`, `label` set, and `onActivate` that calls onClick and is blocked when disabled; `semantics.onFocus(true)` flips the control's focusVisible (assert via the resolved style having the ring, or expose focusVisible); `semantics.onFocus(false)` does NOT show the ring (pointer focus). Existing Button tests still pass.
- Commit: `feat(widgets): Button declares native semantics (role/name/activate) + focus-visible ring`.

### Task 4: demo + browser a11y verification (controller does this)
- Extend an example (e.g. `examples/material` or a new `examples/a11y`) with a few `Button`s (+ disabled). Ensure the canvas' parent is `position:relative` so the overlay sits correctly (set on the wrapper or body).
- Playwright: `browser_snapshot` → assert the accessibility tree shows `button "..."` nodes; press `Tab` → focus lands on the first button (ring painted); `Enter`/`Space` → onClick fires (observe a visible effect / counter); mouse click → activates but NO focus ring; screenshot. Full `pnpm test` + `pnpm typecheck` green.
- Commit: `docs(a11y): SA1 semantics demo + browser a11y verification`.

---

## Self-review
- Coverage: infra+collection+seam+mount (T1), web bridge (T2), Button semantics+fidelity (T3), demo+a11y verify (T4).
- Native behavior is REAL (real DOM elements own focus/keyboard/AT), not simulated. Pointer stays on canvas; single activation per input; focus-visible only on keyboard.
- Platform-agnostic: runtime/widgets declare semantics; only platform-web materializes DOM. `Host.a11y` optional → headless/test hosts simply omit it (mount guards with `?.`).
- Risk: focus double-handling → mitigated by disabling the canvas focus manager when `host.a11y` present. Overlay positioning needs a positioned parent → demo sets it; document the requirement.
- Input (textbox) integration deferred to SA3 (it already owns a hidden input); SA1 skips role:'textbox' in the bridge.
