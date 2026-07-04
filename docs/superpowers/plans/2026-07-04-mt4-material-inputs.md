# MT4 — Material inputs (TextField / Checkbox / Radio / Switch / Select) — Implementation Plan

> REQUIRED SUB-SKILL: superpowers:subagent-driven-development. TDD.

**Architecture (critical):** Material components are a STYLED REFERENCE KIT built ON TOP of the headless `@cairn/widgets`. A Material input MUST wrap the corresponding headless widget and inherit ALL behavior + a11y from it (state, keyboard, focus, semantics) — Material only adds the Material-Design visual language (palette/typography/shape tokens from `MaterialTheme`, ripple, state-layer). Reference `packages/material/src/button.ts`: it wraps `@cairn/widgets` `Button` (variant `'ghost'`), passes `onPointerDown` to drive `createRipple`, and supplies a Material `style`. NEVER re-implement behavior or semantics in Material.

**Reuse:** `useTheme()` → `MaterialTheme` (palette[color].{main,light,dark,contrastText}, typography, elevation, shape.borderRadius, spacing, palette.text/divider/action), `createRipple`, `stateOverlay`, `alpha`/`darken`/`lighten` from `./colors`. Prefer the headless component's **layer-3 render slot** (children as `(state: ControlState & …) => Instance`) to draw Material visuals where available; else pass a Material `style` override. Read the headless source before choosing.

**Each task: create `packages/material/src/<name>.ts` + `packages/material/test/<name>.test.ts` only. DO NOT edit `index.ts` (controller wires exports at the end).** Do NOT run git.

Prereq reading for EVERY task: `packages/material/src/button.ts`, `packages/material/src/theme.ts`, `packages/material/src/colors.ts`, `packages/material/src/state-layer.ts`, `packages/material/src/ripple.ts`, and the specific headless widget source in `packages/widgets/src/`.

---

### Task 1: `Checkbox`
- Headless: `@cairn/widgets` `Checkbox` (`packages/widgets/src/checkbox.ts`) — it exposes a render slot `children?: (state: ControlState & { checked: Accessor<boolean> }) => Instance`. Use it to draw the Material checkbox: a rounded square (`t.shape` small radius) that is outlined (`palette.text.secondary`) when unchecked and filled (`palette.primary.main` + `contrastText` check glyph) when checked; a state-layer/ripple circle behind on hover/press/focus. `Material.Checkbox({ checked?/defaultChecked?/onChange?, color?='primary', disabled?, label? })`. Keep headless props (checked/defaultChecked/onChange/disabled) passed through untouched. Optional `label` → a Row of the box + `Text` (typography.body).
- Tests: renders; passing checked/onChange through toggles; disabled dims; checked visual differs from unchecked (via the render slot output). Behavior/semantics come from headless (do not re-test those).
- Commit: `feat(material): Checkbox (Material box on headless Checkbox)`.

### Task 2: `Radio` (+ RadioGroup re-export)
- Headless: `@cairn/widgets` `Radio`/`RadioGroup` (`packages/widgets/src/radio.ts`). Radio has a render slot analogous to Checkbox — verify and use it to draw the Material radio: outer ring (outline unchecked / `primary.main` checked) + inner filled dot when selected; state-layer/ripple. `Material.Radio({ value, disabled?, label? })` used inside a headless `RadioGroup` (re-export `RadioGroup` from `@cairn/widgets` so Material users have the group). If Radio has no render slot, style-override + overlay dot.
- Tests: renders; selected vs unselected visual; disabled; used within RadioGroup selection (pass-through).
- Commit: `feat(material): Radio (+ RadioGroup) on headless radio`.

### Task 3: `Switch`
- Headless: `@cairn/widgets` `Switch` (`packages/widgets/src/switch.ts`) — check for a render slot; if none, wrap and pass a Material `style` (track + thumb). Material switch: pill track (off = `palette.action`/grey, on = `primary.main` at reduced alpha), circular thumb (elevation shadow) that slides; state-layer/ripple ring on the thumb on hover/press. `Material.Switch({ checked?/defaultChecked?/onChange?, color?='primary', disabled?, label? })`. All toggle behavior/semantics from headless.
- Tests: renders; on/off visual differs; onChange pass-through toggles; disabled dims.
- Commit: `feat(material): Switch (Material track/thumb on headless Switch)`.

### Task 4: `TextField` (floating label)
- Headless: `@cairn/widgets` `Input` (+ `Field` for label/helper/error). `packages/widgets/src/input.ts`, `field.ts`. `Material.TextField({ label?, value?/defaultValue?/onInput?, placeholder?, variant?='outlined'|'filled', color?='primary', disabled?, error?, helperText?, fullWidth? })`. Compose a `Field` (label + helper/error a11y) around the headless `Input`. Material visuals: outlined variant → rounded border (`divider` default, `primary.main` on focus, `error.main` on error) with a notch for the floating label; filled variant → filled surface + bottom border that thickens/colors on focus. Floating label animates position/scale on focus or when value present (simple state-driven position, no spring needed). Helper/error text below in `caption` typography (error → `error.main`). Keep editing/focus/semantics from headless Input.
- Tests: renders label + input; error shows helperText in error color + sets Field error; disabled dims; variant switches border style; floating label reflects focus/value.
- Commit: `feat(material): TextField (floating-label, outlined/filled on headless Input)`.

### Task 5: `Select` (Material menu)
- Headless: `@cairn/widgets` `Select`/`Option` (`packages/widgets/src/select.ts`) — listbox behavior/roving/a11y already there. `Material.Select({ value?/defaultValue?/onChange?, label?, options: {value,label}[] | children, color?='primary', disabled?, fullWidth? })`. Style the trigger like a Material TextField (outlined) with a dropdown caret; style the popover menu as a Material `paper` surface (elevation 8, rounded) with `Material.Option` rows that show a state-layer on hover/selected (`action.selected`). Re-export/compose the headless `Option`. Keep open/close/keyboard/selection/semantics from headless.
- Tests: renders trigger with label; options render; selection pass-through via onChange; disabled; open shows menu (if testable synchronously — else assert structure).
- Commit: `feat(material): Select (Material trigger + menu on headless Select)`.

### Task 6 (controller): exports + demo + browser verify
- Wire MT4 exports (+ types) into `packages/material/src/index.ts`: Checkbox, Radio, RadioGroup, Switch, TextField, Select, (Option if exposed).
- Demo: extend `examples/material` (or add a section) with a Material form — TextField (outlined + error), Checkbox, RadioGroup of Radios, Switch, Select — under a `ThemeProvider`/`createMaterialTheme`.
- Browser + a11y snapshot: `textbox` (TextField), `checkbox`/`radio`/`switch` with checked state, `combobox`/`listbox`+`option` (Select). Verify visuals: floating label, ripple/state-layer, checked fills. Full test + typecheck green.
- Commit: `docs(material): MT4 inputs demo + exports`.

---

## Self-review
- Material wraps headless — behavior/a11y NOT re-implemented (proven by Button pattern). Prefer render slots; style-override fallback.
- LESSONS (from H5/H6): raw string children crash paint — wrap in Text; a painted surface/pill must be a `Box` (Row/Column ignore backgroundColor/padding/border/borderRadius); role 'image'→'img'; verify via `browser_snapshot`; focus events don't fire on `.focus()` in headless.
- YAGNI: no spring animations (simple state-driven transitions), no multiline TextField (needs textarea seam), no autocomplete.
