# Cairn — Material-Design UI Kit (`@cairn/material`) — Roadmap

**Date:** 2026-07-03
**Status:** approved decomposition

## Framing
An independent implementation of the **public Material Design visual language** in Cairn's own code — NOT a copy of MUI's source. Token values (palette, elevation, type scale, shape, spacing) come from the Material Design specification (a public design language). New package `@cairn/material` built on `@cairn/primitives`, `@cairn/widgets`, `@cairn/style`, and the animation/overlay work already shipped.

## Sub-phases
- **MT1 — Theme + tokens.** `createMaterialTheme(opts?)`: `palette` (primary/secondary/error/warning/info/success each main/light/dark/contrastText; background default/paper; text primary/secondary/disabled; divider; action overlays) with light + dark modes; `elevation` (25 shadow presets, 0–24 dp); `typography` (h1–h6, subtitle1/2, body1/2, button, caption, overline as our font fields); `shape.borderRadius`; `spacing(n)=n*8`. Stored on the Cairn `Theme` (extra keys); read via `useTheme()`.
- **MT2 — Ripple + interaction core.** `Ripple` overlay (expanding circle from the pointer via S3 transforms + S7 fade), state layers (hover/focus/pressed translucent overlays), elevation transitions. A `useRipple`/`withRipple` helper components reuse.
- **MT3 — Buttons.** `Button` (`variant: text | outlined | contained`, `color`), `IconButton`, `Fab` — ripple + elevation + Material typography.
- **MT4 — Inputs.** `TextField` (`variant: filled | outlined`, floating label, helper/error text), Material `Checkbox` / `Radio` / `Switch`, `Select` + `Menu` (on Portal).
- **MT5 — Surfaces.** `Paper` / `Card` (elevation), `AppBar` / `Toolbar`, `List` / `ListItem`, `Divider`.
- **MT6 — Feedback + navigation.** `Dialog` (on Portal), `Snackbar`, `Tabs`, `Chip`, `Badge`, `Progress` (linear + circular).
- **MT7 — Showcase.** A demo app exercising every Material component.

## Order
MT1 → MT2 → MT3 → MT4 → MT5 → MT6 → MT7. Each: spec → plan → subagent execution → PR → merge + live browser check.

## Builds on (already shipped)
Overlays/Portal (Dialog/Snackbar/Menu), animations S3 transforms + S7 transitions/spring (ripple, elevation), text-input seam Phase 8 (TextField), reactive theme S6, widgets (base Button/Checkbox/Switch to restyle or wrap).

## Out of scope
Pixel-exact reproduction of MUI's default theme values or component internals; MUI's `sx`/styled API; Material 3 dynamic color / tonal palettes (baseline Material Design only); data grid, date pickers, autocomplete (later).
