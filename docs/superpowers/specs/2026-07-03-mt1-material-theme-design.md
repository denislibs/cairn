# MT1 — Material theme + tokens — Design

**Date:** 2026-07-03
**Status:** approved design
**Part of:** Material kit roadmap (MT1).

## Goal
`@cairn/material` package + `createMaterialTheme(opts?)` producing a Cairn `Theme` carrying Material Design tokens: palette (light/dark), elevation shadows, typography scale, shape, spacing. Material components (MT3+) read these via `useTheme()`.

## Package
New `packages/material` (`@cairn/material`), deps: `@cairn/style`, `@cairn/primitives`, `@cairn/widgets`, `@cairn/runtime`, `@cairn/layout`, `@cairn/host`, `@cairn/events`, `@cairn/reactivity` (workspace:*). Add to the root `typecheck` script. Mirror an existing package's `package.json`/`tsconfig.json`.

## Types
```ts
export interface PaletteColor { main: string; light: string; dark: string; contrastText: string; }
export interface Palette {
  mode: 'light' | 'dark';
  primary: PaletteColor; secondary: PaletteColor;
  error: PaletteColor; warning: PaletteColor; info: PaletteColor; success: PaletteColor;
  background: { default: string; paper: string };
  text: { primary: string; secondary: string; disabled: string };
  divider: string;
  action: { hover: string; selected: string; disabled: string; disabledBg: string; focus: string };
}
export interface TypographyVariant { fontFamily?: string; fontSize: number; fontWeight: number; lineHeight: number; letterSpacing?: number; textTransform?: 'none' | 'uppercase'; }
export type TypographyScale = Record<'h1'|'h2'|'h3'|'h4'|'h5'|'h6'|'subtitle1'|'subtitle2'|'body1'|'body2'|'button'|'caption'|'overline', TypographyVariant>;
export interface MaterialTheme extends Theme {
  palette: Palette;
  elevation: (import('@cairn/style').Shadow[])[]; // 25 entries, index = dp (0..24); [] = none
  typography: TypographyScale;
  shape: { borderRadius: number };
  spacing: (n: number) => number; // n * 8
}
export interface MaterialThemeOptions { mode?: 'light' | 'dark'; primary?: string; secondary?: string; }
export function createMaterialTheme(opts?: MaterialThemeOptions): MaterialTheme;
```

## Token values (from the Material Design spec — public design language)
- **Palette** baseline: primary blue (main `#1976d2`-class blue, with light/dark derived), secondary pink/purple, error red, warning amber, info light-blue, success green — each with `main/light/dark/contrastText`. Light mode: background default `#fafafa`, paper `#fff`, text primary `rgba(0,0,0,0.87)`, secondary `rgba(0,0,0,0.6)`, disabled `rgba(0,0,0,0.38)`, divider `rgba(0,0,0,0.12)`, action overlays as low-alpha black. Dark mode: background default `#121212`, paper `#1e1e1e`, text primary `#fff`, secondary `rgba(255,255,255,0.7)`, etc. (Derive light/dark of a color by lightening/darkening; a `lighten(hex,amt)`/`darken(hex,amt)` helper. `contrastText` = white or black by luminance.) `opts.primary`/`secondary` override the main and derive the rest.
- **Elevation:** 25 entries. `elevation[0] = []`; higher dp = layered shadows (Material uses three overlapping shadows per level — umbra/penumbra/ambient). Generate via a small function producing 2–3 `Shadow` objects per level with increasing blur/offset/spread and low alphas. Index = dp; components pick e.g. `theme.elevation[1]` (Card), `[6]` (FAB), `[8]` (menu), `[24]` (dialog).
- **Typography:** the Material type scale — h1 (light, ~96px), h2 (~60), h3 (~48), h4 (~34), h5 (~24), h6 (~20 medium), subtitle1 (~16), subtitle2 (~14 medium), body1 (~16), body2 (~14), button (~14 medium, uppercase), caption (~12), overline (~10 uppercase) — with the standard weights/line-heights/letter-spacing. Default fontFamily `'Roboto, sans-serif'` (falls back to sans-serif in canvas).
- **shape.borderRadius:** 4. **spacing(n):** `n*8`.

## Helpers
Color utilities in `packages/material/src/colors.ts`: `lighten(hex, amount)`, `darken(hex, amount)`, `alpha(color, a)`, `contrastText(bg)` (luminance-based → `#fff` or `rgba(0,0,0,0.87)`). Pure + tested.

## Usage
`ThemeProvider({ theme: createMaterialTheme({ mode: 'dark' }), children })` (Cairn's ThemeProvider from S6 accepts a Theme). `const t = useTheme<MaterialTheme>();` in components → `t.palette.primary.main`, `t.elevation[2]`, `t.typography.button`, `t.spacing(2)`.

## Testing
- `colors`: `lighten`/`darken` move toward white/black; `alpha` yields `rgba`; `contrastText` picks white on dark bg, dark on light bg.
- `createMaterialTheme`: default light palette present (primary.main a blue hex, contrastText computed); `mode:'dark'` swaps background/text; `opts.primary` overrides `primary.main` and derives light/dark; `elevation.length === 25`, `elevation[0] === []`, `elevation[1]` is a non-empty Shadow[]; typography has all 13 variants with numeric fontSize; `spacing(3) === 24`; `shape.borderRadius === 4`.
- Package builds + typechecks in the workspace.

## Exit criteria
- `@cairn/material` scaffolded; `createMaterialTheme` + color helpers implemented + tested; exported.
- Capability doc / roadmap note the package. One PR merged. (No browser check — tokens are exercised visually starting MT3.)

## Out of scope
Runtime theme merging/overrides API beyond `opts`, Material 3 tonal palettes, CSS-var output, per-component theme overrides (add if needed later).
