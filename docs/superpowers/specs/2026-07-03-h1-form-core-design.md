# H1 — Headless form core — Design

**Date:** 2026-07-03
**Status:** approved design
**Part of:** Headless standard-library roadmap (H1). Builds on H0 foundation.

## Goal
The essential form controls in `@cairn/widgets`, all following the H0 headless pattern (3-layer customization, `createControl`, `mergeStyles`, `useWidgetTheme`, render-fn slot):
`Checkbox`, `Switch`, `Radio` + `RadioGroup` (compound), `Field` (compound label/error/helper wrapper), and `Input` (styled text field on the platform text seam).

**TextArea is deferred to H1b** — a correct multiline field needs a multiline host text-input seam (today the platform proxy is a single-line `<input>`). Rushing it would ship a broken control.

## Pattern (shared)
Every control:
- reads `useWidgetTheme()` for default tokens; default styles via `StyleSheet.create` + theme.
- exposes `style?: StyleInput` merged over defaults via `mergeStyles`; state variants (`hover`/`pressed`/`focus`/`disabled`) restyle reactively; `focusRing` on focus.
- supports controlled + uncontrolled value (mirror the existing `Checkbox` controlled/uncontrolled idiom: `controlled = props.X !== undefined`, internal signal from `defaultX`, `read()` accessor).
- behaviour via `createControl` (keyboard/disabled/focus); disabled blocks change.
- render-fn slot where useful: `children?: Instance | ((state) => Instance)` with the control's state (`{...ControlState, checked/on/value, invalid}`).
- platform-agnostic: no DOM, host-seam only.

## Components

### `Checkbox`
`checked?`/`defaultChecked?`, `indeterminate?`, `onChange(v)`, `disabled?`, `label?`, `style?`, `children?: (s: ControlState & { checked: Accessor<boolean>; indeterminate?: boolean }) => Instance`. Default look: rounded box (theme border), fill + checkmark (Icon) when checked, dash when indeterminate; focus ring; hover. Space toggles. Optional `label` renders a `Text` after the box (whole row clickable).

### `Switch`
Rebuilt on `Toggle` (H0). `checked?`/`defaultChecked?`, `onChange(v)`, `disabled?`, `label?`, `style?`. Default look: track (theme `trackOff`→`trackOn`) + sliding thumb, animated via the existing `transition`. Space/Enter/click toggles.

### `Radio` + `RadioGroup` (compound)
`RadioGroup.Root({ value?, defaultValue?, onChange, disabled?, children })` provides `{ value(), setValue, name, disabled }` via `createCompoundContext('RadioGroup')`. `Radio({ value, disabled?, label?, style? })` reads the group, `checked = groupValue === props.value`, selecting calls the group's `setValue`. Keyboard: Arrow keys move selection within the group (roving); Space selects. Default look: outer ring + inner dot when checked; focus ring.

### `Field` (compound)
`Field.Root({ invalid?, disabled?, children })` provides `{ invalid, disabled, id }` via `createCompoundContext('Field')`. Parts: `Field.Label({children})`, `Field.Control({children})` (slot for the input), `Field.Helper({children})` (muted), `Field.Error({children})` (danger color, shown when `invalid`). Lays out as a Column with theme spacing. Controls inside can read the field context to reflect `invalid`/`disabled` (v1: Field passes nothing automatically to arbitrary children — the control reads `useField()` if it wants; document this).

### `Input`
Styled single-line text field. Wraps the existing `@cairn/primitives` `Input` (which owns the platform text seam + caret) inside a themed frame `Box` (border, radius, padding, background, focus ring). The widgets `Input` lifts the inner field's focus into a signal to drive the frame's focus-ring style (the frame Box is not itself focusable). Props: `value?`, `defaultValue?`, `onInput?`, `onChange?`, `onSubmit?`, `placeholder?`, `disabled?`, `invalid?`, `size?`, `style?` (frame), `inputStyle?` (inner text). Reads `Field` context for `invalid`/`disabled` when present. The inner primitives `Input` is styled transparent (no own bg/border), `width:100%`.

## Testing
- Checkbox: controlled/uncontrolled toggle + onChange; disabled blocks; indeterminate flag; render-fn slot receives checked; focusable.
- Switch: controlled/uncontrolled + onChange; disabled blocks.
- RadioGroup/Radio: selecting a radio sets group value + onChange; controlled group; only one checked; disabled group blocks; arrow-key roving selects.
- Field: context exposes invalid/disabled; Error shown only when invalid; use() throws outside Root.
- Input: onInput/onChange fire; controlled value syncs; disabled; focus lifts to frame (focus-ring style applied); reads Field invalid.
- Full `pnpm test` + `pnpm typecheck` green.

## Exit criteria
- All five (Checkbox/Switch/Radio+RadioGroup/Field/Input) shipped headless, default-styled, overridable; tested.
- Browser: a small form (labelled inputs, checkbox, switch, radio group, an invalid field showing an error) renders, is interactive, and restyles via a `style` override + a render-fn checkbox.
- `packages/widgets/README.md` catalog updated (these → ✅, TextArea note).
- One PR merged.

## Out of scope
TextArea (H1b), Select/Combobox (H2), Slider rework (H3), number/password/masked inputs, form-level validation orchestration (H3 `Form`).
