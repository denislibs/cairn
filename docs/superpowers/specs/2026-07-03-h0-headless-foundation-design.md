# H0 — Headless foundation — Design

**Date:** 2026-07-03
**Status:** approved design
**Part of:** Headless standard-library roadmap (H0–H7). Turns `@cairn/widgets` into the framework's headless component standard library; `@cairn/material` becomes one styled reference kit on top.

## Why

Today Material components hard-wire behaviour (focus, keyboard, disabled, state) into styled `Box`es. A third-party dev who wants a different look must reimplement behaviour. The industry answer: a **headless layer** (behaviour + state, no look) that any design kit consumes.

Constraints from the user:
- Headless components ship **with the framework** (in `@cairn/widgets`), not a separate package. Installing the framework gives `Input`/`Select`/`Form`/… ready to use.
- Components must be **platform-agnostic**: no DOM, no `window`/`document`, all input via the host seam. Only `@cairn/platform-web` touches DOM. A headless component never imports from `platform-web`.
- Components are **default-styled but fully overridable**, and **maximally compound + extensible**.

## The 3-layer customization model

Every component supports, cheapest→most powerful:

1. **Theme tokens (global).** `@cairn/widgets` ships `defaultTheme` (a rich neutral `WidgetTheme`). Components read it via `useWidgetTheme()`, which reads `useTheme()` and deep-merges the user's (possibly partial) theme over `defaultTheme`. No `ThemeProvider` → pure defaults. Partial theme → only the set tokens change.
2. **`style` override per part (local).** Every part accepts `style?: StyleInput` merged **over** the default via `mergeStyles(default, props.style)`. State variants (`hover`/`pressed`/`focus`/`disabled`) come from `Style` sub-objects resolved by the existing `resolveStyle`. So `style: { hover: {...} }` reactively restyles.
3. **Slot / full render (max control).** A part's visual can be replaced entirely. Flat components accept `children?: Instance | ((state: ControlState) => Instance)`; when a render-fn is passed the component renders **no default visual** — the fn owns the look, behaviour stays ours. Compound parts expose the same via their `children`.

## Compound convention

Compound **where structure matters**, flat where it doesn't:
- Compound (context-shared parts): `Select`, `Tabs`, `Dialog`, `Menu`, `RadioGroup`, `Accordion`, `Form`/`Field`.
- Flat (one function + slot escape): `Button`, `Input`, `Checkbox`, `Switch`, `Badge`, `Avatar`, `Chip`, `Progress`, `Spinner`.

Compound parts share state through a context created by `createCompoundContext<T>(name)` → `{ context, use() }`. `use()` throws a clear error outside the `Root`. Parts provide via `Provider`.

State exposed to slots/`style` is uniform: `ControlState = { hovered(), pressed(), focused(), disabled }` (+ component extras like `checked`, `open`, `value`, `invalid`).

## H0 deliverables (this phase only)

New in `@cairn/widgets`:
- `theme.ts` — `WidgetTheme` interface + `defaultTheme` + `useWidgetTheme()` (deep-merge over defaults). `WidgetTheme` satisfies `@cairn/style` `Theme` (colors/spacing/radii/fontSizes are flat records; extras via index).
- `context.ts` — `createCompoundContext<T>(name)`.
- `control.ts` — `createControl(props)` → `{ state: ControlState, handlers }`. Owns hovered/pressed/focused signals, wires pointer/focus handlers, Enter/Space → `onClick`, respects `disabled` (no press/activate). Composes with the user's own handlers.
- `Button` (refactored, headless): `variant` (`solid`/`soft`/`outline`/`ghost`/`link`), `size` (`sm`/`md`/`lg`), `color` (theme color key), `disabled`, `fullWidth`, `onClick`, `style?`, `label?`, `children?: Instance | (state)=>Instance`. Default style from `defaultTheme` via `StyleSheet.create`, merged with `props.style`. Keyboard + focus + disabled via `createControl`. Layout-child props forwarded.
- `Toggle` (new, headless): a two-state button. `pressed?`/`defaultPressed?` (controlled/uncontrolled), `onChange?(v)`, `disabled?`, `style?`, `children?: Instance | (state & {pressed})=>Instance`. Backs `ToggleButton`/`Switch` later.

New in `@cairn/material` (rebuilt on headless):
- `Button`/`IconButton`/`Fab` implemented **on top of** the headless `Button`/`Toggle`, adding ripple (MT2) + elevation + Material typography via `style` + slot. No behaviour duplicated.

Docs:
- `packages/widgets/README.md` skeleton: intro + the 3-layer model + compound convention + a **living component catalog table** (grouped, with a status column) to be filled in across H1–H7. H0 documents `Button`, `Toggle` fully.

## Testing

- `useWidgetTheme`: no provider → defaults; partial theme → merged (set token overridden, others default).
- `mergeStyles`: flattens objects/arrays/fns; later wins; handles `undefined`.
- `createCompoundContext.use()`: returns provided value; throws outside Root.
- `createControl`: hovered/pressed/focused track handlers; disabled blocks press+activate; Enter/Space call onClick; user handlers still invoked.
- `Button`: onClick on click + Enter/Space; disabled blocks; focusable; default style resolves theme color; `style` override merges; render-fn slot receives state.
- `Toggle`: controlled + uncontrolled; onChange fires; disabled blocks.
- Material `Button`/`IconButton`/`Fab`: onClick + disabled + ripple child present + elevation shadow (Fab); built on headless (no duplicated keyboard code).
- Full `pnpm test` + `pnpm typecheck` green.

## Exit criteria
- Foundation utilities shipped + tested; `Button`/`Toggle` headless; Material buttons rebuilt on top.
- Live browser check: default-styled buttons render and ripple; a `style`-overridden button restyles; a render-fn button shows a custom look.
- `packages/widgets/README.md` started with the catalog.
- One PR merged to `main`.

## Out of scope
All other components (H1+). `asChild` for compound parts beyond the flat render-fn slot (revisit if needed). Animation of theme switches.
