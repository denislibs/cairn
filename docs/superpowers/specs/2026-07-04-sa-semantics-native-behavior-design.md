# SA — Semantics & native behavior — Design

**Date:** 2026-07-04
**Status:** approved approach ("сразу фундамент семантики")
**Why:** Requirement — every component must behave 1:1 like its native counterpart (a button IS a button), including accessibility. Canvas is opaque: nothing is native for free. We add a **semantics layer** that mirrors the canvas UI as a hidden tree of real DOM elements, so focus, keyboard, screen readers, and OS assistive tech are genuinely native. This is how Flutter web works; our text `Input` already uses this pattern (hidden `<input>`).

## The three pillars of "native 1:1"
1. **Interaction fidelity** — `:focus-visible` (ring only on keyboard focus), Space activates on keyUP / Enter on keyDown (button semantics), pointer-capture (down→leave→up = no click), right-click doesn't activate, checkbox=Space, radio=arrows move+select with roving tabindex, label-click toggles.
2. **Accessibility** — real roles/names/states exposed to AT; real browser focus; keyboard. (The big missing half.)
3. **Platform conventions** — per-OS keys, mobile native pickers, etc. (adapt behind the host seam; later).

## Architecture

### 1. Semantics descriptor (platform-agnostic, in `@cairn/runtime`)
Add `semantics?: SemanticsNode` to `Instance`.
```ts
type SemanticsRole =
  | 'button' | 'checkbox' | 'radio' | 'switch' | 'textbox' | 'link' | 'slider'
  | 'tab' | 'menuitem' | 'option' | 'listbox' | 'menu' | 'dialog' | 'group'
  | 'heading' | 'image' | 'none';
interface SemanticsNode {
  role: SemanticsRole;
  label?: string;               // accessible name
  description?: string;
  value?: string;               // textbox/slider text value
  checked?: boolean | 'mixed';  // checkbox/radio/switch
  selected?: boolean;           // option/tab
  expanded?: boolean;           // menu/popover/select trigger
  disabled?: boolean;
  readonly?: boolean;
  level?: number;               // heading level
  min?: number; max?: number; now?: number;  // slider/progress
  focusable?: boolean;          // is a focus stop (default true for interactive roles)
  onActivate?: () => void;      // Enter/Space/click/AT-activate
  onFocus?: () => void;
  onBlur?: () => void;
}
```
The component keeps `instance.semantics` in sync inside its existing reactive `bind` (e.g. updates `checked`/`disabled`/`label`). Values are read at collection time.

### 2. Collection (runtime, per frame)
After layout, walk the tree DFS collecting interactive semantics nodes with their **absolute rect** (accumulated offsets). DFS order = tab order. Produce `SemanticsNodeData[]` (each with a stable `id` derived from identity) and hand to `host.a11y?.sync(...)`. Re-collected every frame; the bridge diffs against the live DOM (cheap, keyed by id).

### 3. Host seam (`@cairn/host`)
```ts
interface SemanticsNodeData {
  id: number; role: SemanticsRole; label?; value?; checked?; selected?;
  expanded?; disabled?; readonly?; level?; min?; max?; now?; focusable?;
  rect: { x: number; y: number; width: number; height: number };  // CSS px, surface-relative
  onActivate?: () => void; onFocus?: () => void; onBlur?: () => void;
}
interface AccessibilityBridge {
  sync(nodes: SemanticsNodeData[]): void;
  onFocusChange(cb: (id: number | null, keyboard: boolean) => void): () => void;
  focus(id: number): void;
  dispose(): void;
}
```
Add `a11y?: AccessibilityBridge` to `Host`.

### 4. Web bridge (`@cairn/platform-web` `WebAccessibilityBridge`)
- A visually-hidden overlay `<div>` covering the canvas (`position:absolute; inset:0; pointer-events:none`). Children are transparent, `pointer-events:none` (so they never steal pointer — canvas keeps pointer visuals + click), but keyboard-focusable and read by AT.
- `sync(nodes)`: reconcile keyed by `id`. Map role → element: `button`→`<button>`; `checkbox`→`<div role=checkbox tabindex aria-checked>`; `switch`→`role=switch`; `radio`→`role=radio`; `textbox`→(the text `Input` already owns a hidden `<input>`; register/position it, don't duplicate); `link/menuitem/option/slider/...`→role + aria. Set `aria-label`, `aria-checked/selected/expanded/disabled/readonly`, `aria-valuemin/max/now`, `tabindex` (0 if focusable & !disabled, else -1), and position (`left/top/width/height`) from `rect`. Order children to match the collected order (native Tab order = logical order).
- Listeners: `click` → `onActivate` (fires natively from Enter/Space on a `<button>`, and from AT activation); `focusin`/`focusout` on the container → report focus with a keyboard-vs-pointer flag (track last input modality: keydown→keyboard, pointerdown→pointer); role-specific `keydown` where the element type doesn't do it natively.
- Diff to avoid DOM thrash: only touch attributes/position that changed.

### 5. Focus integration (native becomes source of truth)
- Native browser Tab moves focus among the hidden mirror elements → correct, free tab order + `:focus-visible`.
- The bridge reports `onFocusChange(id, keyboard)` → runtime marks the matching instance as focused and whether focus is "visible" (keyboard). Components paint their focus ring **only when keyboard-focused**.
- The existing canvas `createFocusManager` Tab/key handling is **superseded for semantic nodes**: when `host.a11y` is present, mount does not run the canvas Tab loop for these (avoids double-activation). Pointer click still flows through the canvas pipeline to `onActivate`; keyboard flows through the DOM mirror to `onActivate`. Single activation per input.

### 6. Interaction fidelity (`createControl`, widgets)
- `focused` split into `focused` (has focus) + `focusVisible` (keyboard) — ring uses `focusVisible`.
- Button role: Enter activates on keydown; Space activates on keyUP and is prevented on keydown (no scroll). Checkbox/switch: Space. (For `<button>`/`role` mirrors the browser already does most of this; `createControl` mirrors it for the canvas-driven path.)
- pointer-capture: pressed set on pointerdown; click only if pointerup happens over the element; leaving clears pressed but a return+up still clicks (track the down target).
- right-click / modifier-click does not activate.

## Verification (Playwright — genuinely testable)
- `browser_snapshot` accessibility tree shows `button "Submit"`, `checkbox "Accept" [checked]`, etc.
- Tab moves focus through elements in order; focus ring appears (keyboard) but not on mouse click.
- Enter/Space activate; screen-reader name/role/state correct via the a11y snapshot.
- Pointer click still works and shows ripple/press.

## Staging
- **SA1 (this phase):** semantics infra (type + Instance field + collection), host `AccessibilityBridge` seam, `WebAccessibilityBridge`, **Button** end-to-end (role/name/focus/keyboard/AT + focus-visible), interaction-fidelity in `createControl`, native-focus integration. Demo + Playwright a11y verification.
- **SA2:** Checkbox, Switch, Radio+RadioGroup (roving tabindex), Field labelling.
- **SA3:** Select/Menu/Dialog/Popover/Tooltip (expanded/listbox/dialog roles, focus trap, typeahead), Input registration into the bridge, Slider.
- **SA-retrofit:** ensure every shipped component declares semantics; audit.

## Out of scope (for now)
Full platform-conventions matrix (per-OS keys), mobile native pickers, live regions/announcements API (later), high-contrast/reduced-motion (separate).
