# MT1 — Material theme + tokens — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Steps use `- [ ]`.

**Goal:** `@cairn/material` package + `createMaterialTheme` (palette/elevation/typography/shape/spacing) + color helpers.

Design ref: `docs/superpowers/specs/2026-07-03-mt1-material-theme-design.md`.

**Tech Stack:** TypeScript, pnpm workspace, Vitest. New package: material.

---

### Task 1: package scaffold + color helpers
- Files: `packages/material/package.json`, `packages/material/tsconfig.json`, `packages/material/src/index.ts`, `packages/material/src/colors.ts`; append `packages/material/tsconfig.json` to root `package.json` `typecheck` script; `pnpm install`. Test `packages/material/test/colors.test.ts`.
- `package.json`: name `@cairn/material`, mirror `@cairn/widgets`'s manifest (`main/module/types: ./src/index.ts`, `exports`, deps `workspace:*` on style/primitives/widgets/runtime/layout/host/events/reactivity).
- `tsconfig.json`: copy `packages/widgets/tsconfig.json`.
- `colors.ts` (pure): `parseHex(hex): [r,g,b]`; `toHex([r,g,b])`; `lighten(hex, amt)` (mix toward 255 by amt 0..1); `darken(hex, amt)` (toward 0); `alpha(color, a): string` → `rgba(r,g,b,a)` (accept hex or rgb); `luminance([r,g,b])`; `contrastText(bg): string` → `#fff` if bg dark else `rgba(0,0,0,0.87)`.
- TDD: `lighten('#000000',0.5)` ≈ `#808080`; `darken('#ffffff',0.5)` ≈ `#808080`; `alpha('#000000',0.5)==='rgba(0, 0, 0, 0.5)'`; `contrastText('#1976d2')==='#fff'`, `contrastText('#ffffff')` starts `rgba(0, 0, 0`.
- Commit: `feat(material): package scaffold + color helpers`.

### Task 2: `createMaterialTheme` (palette/elevation/typography/shape/spacing)
- Files: `packages/material/src/theme.ts` (types + `createMaterialTheme`), `packages/material/src/index.ts` (export). Test `packages/material/test/theme.test.ts`.
- Implement per the design spec's types + Material-Design baseline values. Concretely:
  - `makePaletteColor(main)`: `{ main, light: lighten(main,0.2), dark: darken(main,0.3), contrastText: contrastText(main) }`.
  - Light palette: primary `#1976d2`, secondary `#9c27b0`, error `#d32f2f`, warning `#ed6c02`, info `#0288d1`, success `#2e7d32` (Material baseline hues), each via `makePaletteColor`; background `{ default:'#fafafa', paper:'#ffffff' }`; text `{ primary:'rgba(0,0,0,0.87)', secondary:'rgba(0,0,0,0.6)', disabled:'rgba(0,0,0,0.38)' }`; divider `'rgba(0,0,0,0.12)'`; action `{ hover:'rgba(0,0,0,0.04)', selected:'rgba(0,0,0,0.08)', disabled:'rgba(0,0,0,0.26)', disabledBg:'rgba(0,0,0,0.12)', focus:'rgba(0,0,0,0.12)' }`.
  - Dark palette: same brand hues (optionally lightened), background `{ default:'#121212', paper:'#1e1e1e' }`, text `{ primary:'#fff', secondary:'rgba(255,255,255,0.7)', disabled:'rgba(255,255,255,0.5)' }`, divider `'rgba(255,255,255,0.12)'`, action white-alpha overlays.
  - `opts.primary`/`opts.secondary` override the main before `makePaletteColor`.
  - `elevation`: `const elevation = Array.from({length:25}, (_, dp) => dp===0 ? [] : elevationShadows(dp))` where `elevationShadows(dp)` returns 2–3 `Shadow` objects (umbra/penumbra/ambient) with blur/offset/spread scaling with dp and low alphas, e.g. `[{color:'rgba(0,0,0,0.2)', blur: dp*1.5, offsetX:0, offsetY: Math.ceil(dp/2), spread: -1}, {color:'rgba(0,0,0,0.14)', blur: dp, offsetX:0, offsetY: dp, spread: 0}, {color:'rgba(0,0,0,0.12)', blur: dp*2.5, offsetX:0, offsetY: 1, spread: 0}]` (tune so it looks layered).
  - `typography`: the 13 Material variants with numeric `fontSize` (px), `fontWeight`, `lineHeight`, `letterSpacing`; `button`/`overline` `textTransform:'uppercase'`; default `fontFamily:'Roboto, sans-serif'`.
  - `shape:{ borderRadius: 4 }`; `spacing:(n)=>n*8`.
  - Return object also spreads a `colors` map (for ThemeTokens compat: `{ primary: palette.primary.main, ... }`) so generic `(theme)=>Style` consumers still work.
- TDD per the design testing list (palette present, dark mode swaps bg/text, opts override, elevation length 25 + [0]=[] + [1] non-empty, typography 13 variants numeric fontSize, spacing(3)=24, borderRadius=4).
- Commit: `feat(material): createMaterialTheme (palette/elevation/typography/shape/spacing)`.

### Task 3: doc
- Add a line to `docs/styling-and-capabilities.md` (or a new `@cairn/material` note in the inventory) that the Material kit package + theme exist. Full `pnpm test` + `pnpm typecheck` green. Commit (or fold into Task 2).

---

## Self-review
- Coverage: scaffold+colors (T1), theme (T2), doc (T3).
- Values are Material-Design baseline (public spec), composed in our own code — not copied from MUI source.
- MaterialTheme extends Cairn Theme (extra keys) → `useTheme<MaterialTheme>()` works; `colors` map kept for generic consumers.
- No browser check (tokens; exercised from MT3).
