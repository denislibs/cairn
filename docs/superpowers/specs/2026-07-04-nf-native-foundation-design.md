# NF — Native-behavior foundation — Design

**Date:** 2026-07-04
**Status:** approved ("вся возможная нативность сейчас, потом headless либа")
**Builds on:** SA1 (semantics engine + hidden-DOM bridge). Front-loads everything about native behavior that is component-agnostic, then retrofits every existing component to 100% native. Future components (H3+) are then born native.

## Principle
Native behavior = a property of each component, so we can't pre-build it for components that don't exist. What we CAN front-load: (1) the platform bridge for **all** ARIA roles, (2) a shared **toolkit** of native-behavior helpers, (3) retrofit **all existing** components. After this, adding semantics to a new component is a few lines.

## Declarative model (avoids id-plumbing)
Components don't know the bridge ids (assigned during collection). So all native behavior is declared on `SemanticsNode` and driven by flags/callbacks:
- `onActivate?()` — Enter/Space/click/AT activate.
- `onKeyDown?(key: string, mods: {shift;ctrl;alt;meta}): boolean` — forwarded from the element's keydown; return `true` = handled (preventDefault). Components implement arrows / Home/End / Escape / typeahead here.
- `onFocus?(keyboard)`, `onBlur?()`.
- `autoFocus?: boolean` — the bridge focuses this element when it *becomes* the autofocus target (edge-triggered), so components move focus (roving, dialog open) declaratively.
- state fields → aria: `checked` (aria-checked, incl. 'mixed'), `selected`, `expanded`, `disabled`, `readonly`, `value`, `min/max/now` (slider), `level` (heading), `focusable` (tabindex 0/-1 — roving sets this per item).

## NF1 — Foundation (bridge + toolkit + fidelity)

### Bridge (`WebAccessibilityBridge`)
- **All roles** already map to elements; add role-specific keyboard: for focusable non-`button` roles (checkbox/radio/switch/option/menuitem/tab/slider), a keydown of Enter or Space calls `onActivate` (a native `<button>` does this itself). Space is preventDefaulted to avoid scroll.
- **`onKeyDown` forwarding**: element keydown → `node.onKeyDown?.(key, mods)`; if it returns true, `preventDefault()`.
- **`autoFocus`**: after sync, if a node with `autoFocus:true` is different from the last-autofocused id, call `.focus()` on it (edge-triggered; store lastAutoFocusId).
- **`announce(message, assertive?)`**: maintain two visually-hidden `aria-live` regions (polite + assertive); set textContent to announce.
- Full aria attribute coverage (value/min/max/now/selected/expanded/level/labelledby via label).
- Keep the SA1 focus-stability rule (reorder only when order changed).

### Toolkit (headless, `@cairn/widgets`) — reusable native behavior
- `createRoving({ count, orientation, loop })` — active-index state + a `handleKey(key)` that moves active on Arrow/Home/End (returns handled). The component maps active→ per-item `focusable` (active item tabindex 0, rest -1) + `autoFocus` on the active item. Pure logic.
- `createTypeahead({ getLabels, onMatch })` — buffers typed chars (reset after ~500ms), matches a label prefix, calls onMatch(index). Pure logic (uses the host scheduler/time via a passed clock or a simple counter; avoid Date.now — pass via option or accept slight simplification).
- `useAnnounce()` — returns `announce(msg, assertive?)` bound to `host.a11y?.announce`.
- Key convention constants/helpers (Arrow*, Home, End, Escape, Enter, Space, PageUp/Down).
- Focus-trap: a `createFocusTrap` helper stub built on `autoFocus` + `onKeyDown` (Tab cycling within a set) — full modal trap lands with Dialog (H4); NF1 ships the helper + the bridge primitives it needs.

### `createControl` fidelity
- pointer-capture (down→leave→up = no click; return+up = click) via tracking the down target.
- Space activates on keyUP, Enter on keyDown (button semantics) — for the no-a11y fallback path.
- right-click guard (done).

## NF2 — Retrofit form controls
`Checkbox` (role checkbox, aria-checked, Space toggles via bridge), `Switch` (role switch, aria-checked), `Radio`+`RadioGroup` (radiogroup + radio, aria-checked, roving via `createRoving`, arrows move+select), `Field` (associates its label with the control — set the control's `label`/description; Field.Error announced via `useAnnounce` when it appears).

## NF3 — Retrofit overlays + Input
`Select` (combobox + listbox popup, expanded, options with selected, typeahead, autoFocus into the list on open, Escape closes, arrows navigate), `Menu`+`MenuItem` (menu/menuitem, roving, typeahead, Escape), `Popover`/`Tooltip` (appropriate roles + dismiss semantics), `Input` (role textbox — coordinate with its existing hidden `<input>`: the bridge must NOT duplicate a textbox element; Input registers its own input/semantics so focus + editing stay native). `Dialog`/`Drawer` are H4 — full focus-trap lands there using NF1 primitives.

## Verification
- Unit tests per bridge feature + toolkit helper.
- Browser: `browser_snapshot` a11y tree shows correct roles/names/states (checkbox [checked], radiogroup with radios, combobox [expanded], etc.); keyboard drives them (Space toggles checkbox, arrows move radios/menu, typeahead jumps, Escape closes). Verify focus via dispatched events (Playwright headless focus-event caveat).

## Out of scope (deferred)
Full modal focus-trap (with Dialog, H4), per-OS key-convention matrix, mobile native pickers, high-contrast/reduced-motion. Live-region announcements API ships (basic) in NF1.
