# H3 — Form + Slider + Combobox — Implementation Plan

> REQUIRED SUB-SKILL: superpowers:subagent-driven-development. TDD. All three are **born-native**: declare `instance.semantics` using the NF toolkit; reactive fields synced via `createEffect`.

Design: `docs/superpowers/specs/2026-07-04-h3-forms-slider-combobox-design.md`.

**Reuse:** `useWidgetTheme`, `createControl`, `mergeStyles`, `StyleSheet`, `Box/Row/Column/Text/Icon/Portal/computePlacement/getAbsRect` (primitives), `Input` (primitives, native textbox), `createCompoundContext`, `createRoving`/`createTypeahead`/`keys`/`useAnnounce` (widgets/native), `createSignal`/`createEffect`. Reference `select.ts` (combobox/listbox+roving), `radio.ts` (roving+semantics effects), `button.ts` (focus-visible outline), `field.ts` (Field context). `SemanticsNode` roles: add `'form'` to `SemanticsRole` if Form uses it (optional).

---

### Task 1: `Slider` (rework, headless + native)
- Rewrite `packages/widgets/src/slider.ts`. Props: `value?: number|Accessor<number>`, `defaultValue?`, `min=0`, `max=100`, `step=1`, `onChange?(v)`, `disabled?`, `orientation?='horizontal'`, `label?`, `style?`. Controlled/uncontrolled.
- Themed default: track (theme border/surfaceAlt), fill (primary), thumb (surface + border, shadow); 3-layer `style` via mergeStyles. Drag: pointer down/move on the track → value from localX/width (clamp+snap to step). Keyboard via `semantics.onKeyDown`: ArrowRight/Up +step, ArrowLeft/Down −step, Home→min, End→max, PageUp +10%span, PageDown −10%span; return true when handled.
- Native: `instance.semantics = { role:'slider', label, min, max, now: read(), disabled, focusable: !disabled, onKeyDown, onFocus:(kb)=>setFV(kb), onBlur }`, synced (now/disabled) via createEffect. Focus-visible ring (outline). `onChange` on commit.
- Rewrite `packages/widgets/test/slider.test.ts`: controlled/uncontrolled; clamp+snap; keyboard onKeyDown adjusts by step/Home/End/Page; semantics role slider + now reflects value; disabled blocks.
- Commit: `feat(widgets): headless native Slider (role=slider, keyboard, themed, 3-layer)`.

### Task 2: `Form` (validation/submit)
- New `packages/widgets/src/form.ts`. `createCompoundContext('Form')` value `{ values: Accessor<Record<string,any>>; errors: Accessor<Record<string,string>>; getValue(name); setValue(name,v); getError(name): string|undefined; register(name, opts?:{validate?:(v,values)=>string|undefined}); submit(): void; touched: (name)=>boolean }`.
- `Form({ initialValues?, validate?, onSubmit, validateOnBlur?, children })`: signals for values/errors/touched. `submit()`: run per-field validators + the form-level `validate(values)`, merge errors; if none → `onSubmit(values)`, else set errors + `useAnnounce()` the first error message (politely/assertive). Provide the context via Provider.
- `useForm()` (throwing) + `useFormOptional()`. `useFormField(name)` → `{ value, setValue, error, markTouched }` bound to the form.
- Integrate: extend `Input` (widgets, `packages/widgets/src/input.ts`) with an optional `name?: string`; when inside a Form, it binds value/onInput to `useFormField(name)` and reports blur→markTouched; and `Field.Error` (widgets) can show `useFormOptional()?.getError(name)` — keep integration minimal + documented (don't break standalone use).
- Tests `packages/widgets/test/form.test.ts`: setValue/getValue; submit with a failing validator sets error + does NOT call onSubmit; submit clean calls onSubmit(values); per-field + form-level validators; useForm throws outside; error announced (mock host a11y).
- Commit: `feat(widgets): Form — values/validation/submit context + field binding`.

### Task 3: `Combobox` + `Combobox.Option` (autocomplete)
- New `packages/widgets/src/combobox.ts`. `createCompoundContext('Combobox')`. `Combobox({ value?/defaultValue?, onChange, onInputChange?, placeholder?, disabled?, children })`: a text `Input` (primitives, native textbox) whose value filters the registered options; a Portal listbox of matching `Combobox.Option`s (reuse Select's overlay/placement + `createRoving`). Native: the input carries `role:'combobox'` semantics with `expanded` + (document aria-autocomplete='list' via a new optional semantics field OR reuse expanded only for MVP); options `role:'option'` + `selected`. Keyboard: ArrowDown opens/moves active, Enter selects active (sets input text + value + closes), Escape closes, typing filters + opens. Outside-click closes (catcher, like Select).
- `Combobox.Option({ value, label?, children? })` registers `{value,label}`; visible only when it matches the current input filter (case-insensitive substring); selecting sets value+text.
- Tests `packages/widgets/test/combobox.test.ts`: typing filters options; ArrowDown+Enter selects (sets value + input text + onChange); Escape closes; controlled/uncontrolled; semantics role combobox + option roles.
- Commit: `feat(widgets): Combobox + Option (autocomplete, filtered listbox, native combobox)`.

### Task 4: README + demo + browser verify (controller does browser)
- Update `packages/widgets/README.md` catalog: Slider/Form/Combobox → ✅ (+ snippets).
- Extend a demo (e.g. `examples/forms` or new `examples/h3`): a Slider, a small Form (inputs + validation + submit showing/announcing errors), a Combobox. Ensure canvas parent positioned.
- Browser: a11y snapshot (slider valuenow, combobox expanded+options); Slider keyboard; Combobox filter+select; Form submit validation. Full `pnpm test` + `pnpm typecheck` green.
- Commit: `docs(widgets): H3 demo + README (Slider/Form/Combobox)`.

---

## Self-review
- Born-native: each declares semantics via NF toolkit (roving/announce/onKeyDown/autoFocus).
- Reuses Select overlay pattern (Combobox), Input native textbox, Field (Form errors).
- LESSONS: `mainAxisSize` is a prop; overlay content is collected (NF3 fix) so Combobox options appear in a11y tree; verify a11y via browser_snapshot.
