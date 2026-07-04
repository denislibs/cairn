# MT5–MT7 — Material surfaces + feedback/nav + showcase — Implementation Plan

> REQUIRED SUB-SKILL: superpowers:subagent-driven-development. TDD.

**Architecture (critical):** Material = a STYLED reference kit ON TOP of headless `@cairn/widgets`. Each Material component wraps the corresponding headless widget and inherits ALL behavior + a11y; Material adds only the Material-Design visual language (`MaterialTheme` palette/typography/elevation/shape, ripple, state-layer). Canonical pattern: `packages/material/src/button.ts` and the MT4 files (`checkbox.ts`, `textfield.ts`, `select.ts`). NEVER re-implement behavior/semantics.

**Reuse:** `useTheme()` → `MaterialTheme`, `createRipple`, `stateOverlay`, `alpha`/`darken`/`lighten`. `Box/Row/Column/Text/Stack` from `@cairn/primitives`.

**Invariants (learned):** Row/Column (FlexNode) do NOT paint `backgroundColor`/`padding`/`border`/`borderRadius` — any painted surface/pill MUST be a `Box`. Wrap string children in `Text` (raw strings crash paint). When wrapping a headless control + adding a label, keep semantics on ONE node (don't duplicate). `role:'image'`→ bridge maps to `img`.

**Each task: create `packages/material/src/<name>.ts` + `packages/material/test/<name>.test.ts` only. DO NOT edit `index.ts` (controller wires all exports at the end). Do NOT run git.** Prereq reading every task: `packages/material/src/button.ts`, `theme.ts`, `colors.ts`, `state-layer.ts`, `ripple.ts`, the headless source in `packages/widgets/src/`, and `packages/material/test/button.test.ts` + `recording-renderer.ts`.

---

## MT5 — Surfaces

### Task 1: `Paper`
- `Paper({ children, elevation?: 0..24, square?: boolean, style? })`. A Material surface `Box`: `backgroundColor: palette.background.paper`, `borderRadius: square ? 0 : shape.borderRadius`, `boxShadow: elevation[clamp(elevation)]`. Accepts single/array children (Column). Semantics `role:'group'` optional. Base building block for Card/Dialog/Menu.
- Tests: elevation maps to a shadow; square removes radius; renders children.

### Task 2: `Card`
- `Card({ children, elevation?=1, variant?: 'elevation'|'outlined', interactive?, onClick?, style? })`. Wrap the headless `Card` (`@cairn/widgets`) for behavior (interactive → role button + keyboard), applying Material surface style (paper bg, elevation shadow OR outlined border via `divider`, shape radius). Add ripple when interactive (drive from headless pointer if available, else state-layer). Slots: optional `Card.Content`/`Card.Actions` as simple padded Row/Column helpers (nice-to-have; keep minimal).
- Tests: elevation vs outlined style; interactive passes onClick through headless; renders children.

### Task 3: `AppBar`
- `AppBar({ children, color?: MaterialColor|'default'|'transparent'='primary', elevation?=4, position?: 'static', style? })`. A Material top bar `Box` (height 56–64, padding 16, `backgroundColor` = palette[color].main or paper for 'default', `contrastText` for content color, `boxShadow: elevation`). A `Row` of children (align center, gap). Optional `AppBar.Title` = Text in `h6` typography. Semantics `role:'navigation'` or `group` with label.
- Tests: color/elevation applied; renders a title + actions row.

### Task 4: `List` (Material)
- Wrap headless `List`/`List.Item` (`@cairn/widgets`). `Material.List({ children, dense?, style? })` + `Material.List.Item({ children, leading?, trailing?, onClick?, disabled?, selected? })`. Apply Material list styling: item height (48/56, dense 40), hover/selected state-layer (`action.hover`/`action.selected`), typography (body1 primary text). Keep list/listitem semantics + click behavior from headless. Re-export via `List.Item`.
- Tests: item renders with leading/trailing; selected/hover style; onClick pass-through; roles from headless.

## MT6 — Feedback + navigation

### Task 5: `Dialog`
- Wrap headless `Dialog` (`@cairn/widgets`: `Dialog`, `Dialog.Trigger/Content/Title/Description/Close`, `dialogContext`). `Material.Dialog({...})` re-exposes the compound parts, styling `Dialog.Content` as a Material paper surface (elevation 24, rounded, max-width, padding 24), `Dialog.Title` in `h6`, actions area. Keep modal/focus-trap/a11y from headless. Re-export the parts (Trigger/Content/Title/Actions/Close).
- Tests: content styled as paper; parts render; behavior delegated to headless (assert structure/semantics).

### Task 6: `Snackbar`
- Wrap headless toast (`@cairn/widgets`: `ToastProvider`/`useToast`). `Material.SnackbarProvider` (re-export/compose `ToastProvider`) + `useSnackbar` (thin wrapper over `useToast`) rendering Material snackbar surface: dark `#323232` rounded Box, `body2` white text, optional action button (Material text button in `secondary`/`primary`). Keep placement/timeout/a11y from headless.
- Tests: provider renders; enqueue shows a styled snackbar (or assert the render fn output structure); action wired.

### Task 7: `Tabs` (Material)
- Wrap headless `Tabs` (`@cairn/widgets`: `Tabs`, `Tabs.List/Tab/Panel`). `Material.Tabs` re-exposes the parts with Material styling: tab row with bottom divider, active tab `primary.main` text + an animated/underline indicator bar (a `Box` under the active tab; simple position via active index — no spring needed), ripple/state-layer on tabs, `button`-style uppercase label typography. Keep roving/selection/tabpanel a11y from headless.
- Tests: tab/tablist/tabpanel roles from headless; active tab styled; indicator present; selection pass-through.

### Task 8: `Chip` (Material)
- Wrap headless `Chip` (`@cairn/widgets`). `Material.Chip({ label, color?, variant?: 'filled'|'outlined', size?, onClick?, onDelete?, disabled?, avatar?/icon? })`. Material styling: filled = `palette[color]` soft/solid per M2, outlined = `divider` border; rounded-full; ripple when clickable; delete `×` styled. Keep behavior/semantics (chip button + separate Remove) from headless.
- Tests: filled vs outlined; onClick/onDelete pass-through; disabled; label renders.

### Task 9: `Badge` (Material)
- Wrap headless `Badge` (`@cairn/widgets`). `Material.Badge({ children, badgeContent, color?, variant?: 'standard'|'dot', max?, overlap?, style? })`. Material styling: `palette[color].main` bg + `contrastText`, positioned top-right overlay on children, standard vs dot. Keep count/dot/status semantics from headless.
- Tests: content over max → `max+`; dot variant; overlay on child; color applied.

### Task 10: `Progress` (Material — linear + circular)
- Wrap headless `Progress` (linear) for `Material.LinearProgress({ value?, variant?: 'determinate'|'indeterminate', color?, style? })` with Material track/bar colors + rounded. Also add `Material.CircularProgress({ value?, size?=40, thickness?=3.6, variant?, color? })` — a canvas arc (use `Icon`/a custom paint Box or the primitives arc capability; if none, draw a ring via a `Box` with border + a rotating partial arc). Semantics `role:'progressbar'` with aria-value* (reuse headless where possible; for circular, set semantics manually — bridge already supports progressbar range). Indeterminate may be a static partial arc (no spin required, but a self-driven rotation via `animate` is a plus).
- Tests: linear determinate width; circular renders with value → progressbar semantics min/max/now; indeterminate omits now; color applied.

## MT7 — Showcase (controller)
- Wire ALL MT5–MT7 exports (+ types) into `packages/material/src/index.ts`.
- Demo `examples/mt-showcase`: an AppBar; a Card (elevation + outlined) containing a Material List; Tabs with panels; Chips (filled/outlined/deletable); a Badge on an icon; Linear + Circular Progress; a Dialog (trigger → paper dialog); a Snackbar trigger. Under `ThemeProvider`/`createMaterialTheme`.
- Browser + a11y snapshot: surfaces render with elevation; `list`/`listitem`, `tablist`/`tab`/`tabpanel`, `dialog` (modal), `progressbar` with values, `img`/`status` badges, chip `button`/`Remove`. Full test + typecheck green. Fix any issues found.
- Commit.

---

## Self-review
- Everything wraps headless (behavior/a11y not re-implemented). Painted surfaces are Box. Strings wrapped in Text. Single semantics node per control.
- YAGNI: no spring physics (simple state-driven transitions), circular-progress spin optional, no AppBar scroll behaviors.
