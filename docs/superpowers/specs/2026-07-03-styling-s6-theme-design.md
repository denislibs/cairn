# Styling S6 — Theme, Tokens, Variants, Cursor — Design

**Date:** 2026-07-03
**Status:** approved design
**Part of:** production-ready styling roadmap (S6 of S7).

## Goal
Live (reactive) theming incl. light/dark switching, design-token structure, a component variant system, and interaction styling: `cursor`, `pointerEvents: none`, `userSelect`.

## 1. Reactive theme (live light/dark)
Today `themeContext` holds a static `Theme` value; `createInteractive` captures `useTheme()` once, so theme changes don't restyle. Make it reactive:
- `themeContext` becomes `Context<() => Theme>` (holds a theme accessor); default `() => ({})`.
- `useTheme(): Theme` = `useContext(themeContext)()` — calling the accessor inside a reactive scope tracks a signal-backed theme.
- `ThemeProvider({ theme, children })` accepts `theme: Theme | (() => Theme)`, normalizes to an accessor, and provides it.
- `createInteractive`: move the `useTheme()` call INTO `resolved()` (currently captured once at construction) so a theme change re-runs the resolved-style memo → restyles paint+layout.
Usage: `const [mode, setMode] = createSignal('light'); ThemeProvider({ theme: () => mode() === 'dark' ? dark : light, children })`. Toggling `mode` re-themes the whole subtree live.

## 2. Design tokens
`Theme` stays `Record<string, unknown>` (freeform) but gains an optional typed shape for common scales, non-breaking:
```ts
export interface ThemeTokens {
  colors?: Record<string, string>;
  spacing?: Record<string, number>;
  radii?: Record<string, number>;
  fontSizes?: Record<string, number>;
}
export type Theme = ThemeTokens & Record<string, unknown>;
```
`createTheme(tokens)` unchanged (identity). Consumers read `theme.colors?.primary` etc. This is typing/convention only.

## 3. Variants
A small helper in `@cairn/style`:
```ts
export function resolveVariant<T>(map: Record<string, T>, selected: string | undefined, fallback?: string): T | undefined;
```
returns `map[selected]` (or `map[fallback]`, or undefined). Components accept a `variant` prop and merge `resolveVariant(VARIANTS, props.variant)` into their style array (the widget `Button` already does this ad-hoc; keep it, and this helper standardizes the pattern). No new component API beyond exposing the helper.

## 4. cursor
`BaseStyle.cursor?: string` (CSS cursor keyword). `Instance.cursor?: string`; `Box`/`Flex`/`Text` set it from resolved style. On hover change, the topmost hovered instance's cursor is applied to the canvas:
- `Host` gains optional `setCursor?(cursor: string): void`; `@cairn/platform-web`'s host implements it as `canvas.style.cursor = cursor`.
- `createPointerDispatcher` gains an optional `onHoverChange?(path: HitNode[])` hook, fired by `syncHover` when the hover path changes.
- `mount` wires it: on hover change, walk the path (target→root) for the first node with a `cursor`, default `'default'`, and call `host.setCursor?.(cursor)`.

## 5. pointerEvents + userSelect
- `BaseStyle.pointerEvents?: 'auto' | 'none'`; `HitNode`/`Instance` gains `pointerEvents?`. `hitTest` skips a node (and its subtree) when `pointerEvents === 'none'` — returns null for that node so pointers pass through (overlay-passthrough). `Box`/`Flex`/`Text` set it from style.
- `BaseStyle.userSelect?: 'auto' | 'none' | 'text'`: stored on the instance but INERT for now (text selection is deferred to a later phase) — typed + documented so styles can declare intent.

## Testing
- Reactive theme: a `(theme) => Style` primitive restyles when a signal-backed theme changes (assert resolved style before/after `setMode`).
- `resolveVariant`: selected / fallback / missing.
- cursor: dispatcher `onHoverChange` fires with the hover path on enter; mount-level cursor pick chooses the topmost cursor (unit-test the pure "first cursor in path" picker).
- pointerEvents: `hitTest` returns the node under a `pointerEvents:'none'` overlay, not the overlay.
- Full `pnpm test` + `pnpm typecheck` green; defaults unchanged.

## Exit criteria
- Live theming (light/dark), token typing, `resolveVariant`, `cursor`, `pointerEvents:none` work + tested (`userSelect` typed/inert).
- Capability doc §9/§11 rows flipped to ✅ where shipped (cursor, pointerEvents, live light/dark, tokens, variants). `userSelect` noted as inert-until-selection.
- One PR merged to `main`.

## Out of scope
`userSelect` runtime behavior (needs text selection), per-node cursor regions beyond hover target, system theme auto-detection, animated theme transitions.
