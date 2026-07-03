# NF3 — Native overlays (retrofit) — Implementation Plan

> REQUIRED SUB-SKILL: superpowers:subagent-driven-development. TDD.

**Goal:** make `Select`+`Option`, `Menu`+`MenuItem`, `Popover`, `Tooltip` fully native (roles/states/keyboard/AT) using the NF1 foundation. (Input textbox a11y = NF3b, separate — it needs unifying the text seam with the mirror; NOT in this plan.)

Design: `docs/superpowers/specs/2026-07-04-nf-native-foundation-design.md`. Builds on NF1/NF2.

**Read first:** `packages/widgets/src/select.ts`, `menu.ts`, `popover.ts`, `tooltip.ts`; `packages/widgets/src/native/roving.ts`, `typeahead.ts`, `keys.ts`; `packages/runtime/src/semantics.ts`; NF2 `radio.ts` for the roving+semantics+effect pattern. `SemanticsRole` includes button/menu/menuitem/listbox/option/dialog/tab/... — add any missing (e.g. `combobox`) to `packages/host/src/accessibility.ts`.

**Reactive-semantics pattern** (from NF2): set `instance.semantics={...}` once, keep changing fields (expanded/selected/checked/focusable/autoFocus/value) live via `createEffect`.

---

### Task 1: `Select` + `Option` native
- **Add `'combobox'`** to `SemanticsRole` if missing.
- Trigger instance: `semantics = { role:'combobox', label: selectedLabel or placeholder, expanded: open(), disabled, value: selectedLabel(), onActivate: toggleOpen, onKeyDown: (key)=> { open on Enter/Space/ArrowDown; if open, Arrow/Home/End move active (roving), Enter selects active, Escape closes; printable char → typeahead }, onFocus, onBlur }`. Keep expanded/value synced via effect.
- Options (in the listbox): each `Option` instance `semantics = { role:'option', label, selected: value===current, focusable: index===active, autoFocus: index===active (transient on open/move), onActivate: ()=> select(value) }`. Use `createRoving` + `createTypeahead` (getLabels from registered options) in the Select.
- On open: autoFocus the selected (or first) option; on close: focus returns to the trigger (set trigger autoFocus, or rely on native — set trigger focusable, autoFocus on close).
- Tests: trigger role combobox + expanded reflects open; options role option + selected reflects value; onKeyDown ArrowDown opens; when open, arrows move active + Enter selects + Escape closes; typeahead jumps to a matching option.
- Commit: `feat(widgets): Select/Option native (combobox+listbox, expanded, roving, typeahead, escape)`.

### Task 2: `Menu` + `MenuItem` native
- Menu content container: `semantics = { role:'menu' }`; opening sets trigger `expanded`. `MenuItem`: `semantics = { role:'menuitem', label, disabled, focusable: index===active, autoFocus: index===active, onActivate: ()=> { onSelect(); close(); } , onKeyDown via the menu's roving/typeahead }`. Menu uses `createRoving` (already has an active index — migrate to the toolkit or keep + add semantics) + `createTypeahead`; Escape closes (trigger refocus); Enter/Space activate.
- Trigger: if it's a widgets `Button` it already has button semantics — set `aria-haspopup`/`expanded` by giving the trigger wrapper a semantics with expanded, OR document that Menu sets expanded on the trigger's semantics. Keep pragmatic: expose expanded on the trigger.
- Tests: MenuItem role menuitem; open shows items; roving arrows move active; Enter/onActivate fires onSelect + closes; disabled item skipped; Escape closes.
- Commit: `feat(widgets): Menu/MenuItem native (menu+menuitem, roving, typeahead, escape)`.

### Task 3: `Popover` + `Tooltip` roles
- `Popover`: ensure the trigger is activatable (if the user passes a widgets Button it already has role button + can carry `expanded`); give the popover content container `role:'dialog'` (non-modal) OR leave as generic — set `expanded` on the trigger when open; Escape/outside-close already exist (H2). Keep light: trigger expanded reflects open.
- `Tooltip`: give the bubble `semantics = { role:'tooltip', label }`. (aria-describedby linking is deferred — no id plumbing.)
- Tests: Popover trigger expanded reflects open; Tooltip bubble has role tooltip.
- Commit: `feat(widgets): Popover/Tooltip roles (dialog/tooltip, expanded)`.

### Task 4: demo + browser a11y verify (controller does the browser part)
- Ensure `examples/overlays-kit` canvas parent is positioned. Verify via `browser_snapshot`: `combobox [expanded]` with `option [selected]`; `menu`/`menuitem`; keyboard opens/navigates/selects/closes. Full `pnpm test` + `pnpm typecheck` green.
- Commit: `docs(a11y): NF3 overlays demo + verification`.

---

## Self-review
- Reuses NF1: onKeyDown (arrows/escape/type), autoFocus (open→list, close→trigger), createRoving/createTypeahead, expanded/selected aria.
- Input textbox a11y intentionally deferred to NF3b (text-seam ↔ mirror unification) — noted so it isn't forgotten.
- Verify a11y via browser_snapshot (roles/states); keyboard via dispatched events where focus is involved (Playwright headless caveat).
