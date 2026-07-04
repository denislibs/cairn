# H3 — Form + Slider + Combobox — Design

**Date:** 2026-07-04
**Status:** approved. First component phase built **born-native** (semantics/a11y baked in via the NF toolkit).

## Goal
Three headless components in `@cairn/widgets`, each: behavior + default style (3-layer customization) + **native semantics** (roles/keyboard/AT) from the start.
- `Slider` (rework the old raw one) — themed, native `role=slider`.
- `Form` — validation + submit orchestration over fields.
- `Combobox` — text input + filtered listbox (autocomplete).

## Slider
`Slider({ value?/defaultValue?, min=0, max=100, step=1, onChange, disabled?, orientation?='horizontal', label?, style? })`. Track + fill + thumb, themed (`useWidgetTheme`), 3-layer `style`. Drag via pointer (localX/Y → value), keyboard via `semantics.onKeyDown` (Arrow ±step, Home→min, End→max, PageUp/Down ±10%). `semantics = { role:'slider', label, min, max, now: read(), disabled, onKeyDown, onFocus, onBlur }` (aria-valuemin/max/now via bridge). Focus-visible ring. Controlled/uncontrolled.

## Form
Compound: `Form({ initialValues?, validate?, onSubmit, children })` provides a context `{ values, errors, setValue, getError, register(name, opts?), submit() }`. Fields bind by `name`. Validation: a `validate(values) => errors` function and/or per-field validators; runs on `submit()` (and on blur if `validateOnBlur`). `submit()` validates → if clean calls `onSubmit(values)` else populates `errors` + **announces** the first error (`useAnnounce`). `useForm()` hook + a `useFormField(name)` returning `{ value, setValue, error, touched }`. Integrate with existing `Field`/`Input`: an `Input` with a `name` inside a `Form` auto-binds (reads `useForm`), and `Field.Error` shows `getError(name)`. Submit button calls `form.submit()`; Enter in a field submits. Keep it pragmatic and typed loosely (`Record<string, any>`).

## Combobox
Compound autocomplete: `Combobox({ value?/defaultValue?, onChange, onInputChange?, placeholder?, disabled?, children })` + `Combobox.Option`. A text `Input` (native textbox) whose typing **filters** the option list; a listbox popup (Portal) of matching `Combobox.Option`s. Native: trigger input `role=combobox` + `aria-expanded` + `aria-autocomplete='list'`; options `role=option` + `selected`; ArrowDown opens/moves, Enter selects, Escape closes, typing filters + opens. Reuses Input (NF3b), Portal + placement, `createRoving`. Selecting sets the input text + value.

## Verification
Unit tests per component (behavior + semantics). Browser: a11y snapshot shows `slider [valuenow]`, `combobox [expanded]`→filtered `option`s; Slider keyboard adjusts value; Combobox typing filters + Enter selects; Form submit validates + shows/announces errors. Full test + typecheck green.

## Out of scope
Range/dual-thumb slider, vertical slider polish, async Combobox options, multi-select Combobox, Form async validation / field arrays.
