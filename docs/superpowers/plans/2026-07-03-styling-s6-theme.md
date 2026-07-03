# Styling S6 — Theme, Tokens, Variants, Cursor — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Steps use `- [ ]`.

**Goal:** Live theming (light/dark) + tokens + variants + cursor/pointerEvents/userSelect.

Design ref: `docs/superpowers/specs/2026-07-03-styling-s6-theme-design.md`.

**Tech Stack:** TypeScript, pnpm workspace, Vitest. Packages: style, primitives, runtime, events, host, platform-web.

---

### Task 1: reactive theme (live light/dark)
- Files: `packages/style/src/theme.ts` (context → accessor; `useTheme` calls it; `ThemeTokens`), `packages/primitives/src/theme-provider.ts` (accept `Theme | () => Theme`), `packages/primitives/src/interactive.ts` (read `useTheme()` inside `resolved()`), test `packages/primitives/test/reactive-theme.test.ts`.
- theme.ts:
```ts
export interface ThemeTokens { colors?: Record<string,string>; spacing?: Record<string,number>; radii?: Record<string,number>; fontSizes?: Record<string,number>; }
export type Theme = ThemeTokens & Record<string, unknown>;
export function createTheme<T extends Theme>(tokens: T): T { return tokens; }
export const themeContext: Context<() => Theme> = createContext<() => Theme>(() => ({}));
export function useTheme<T extends Theme = Theme>(): T { return useContext(themeContext)() as T; }
```
- theme-provider.ts: `theme: Theme | (() => Theme)`; `const getter = typeof props.theme === 'function' ? props.theme : () => props.theme;` provide `themeContext` value `getter`.
- interactive.ts: `resolved()` currently uses a captured `theme`. Change to read `useTheme()` inside `resolved()`:
```ts
const resolved = (): BaseStyle => {
  const states: StateName[] = []; if (hovered()) states.push('hover'); if (pressed()) states.push('pressed'); if (focused()) states.push('focus');
  return resolveStyleInput(props.style, useTheme(), states);
};
```
Remove the top-level `const theme = useTheme();` (or keep but don't use). Ensure `useTheme` imported.
- TDD: build a signal `[mode,setMode]`; `ThemeProvider({theme: () => ({colors:{fg: mode()==='dark'?'#fff':'#000'}}), children})` wrapping a Box with `style: (t)=>({color: t.colors.fg})`; assert resolved color flips after setMode('dark') + flush. (Or test at the `useTheme`/interactive level with a manual provider scope.) Keep the test deterministic with `createRoot`.

### Task 2: resolveVariant + token typing
- Files: `packages/style/src/variant.ts` (`resolveVariant`), export from index; (ThemeTokens already added in T1). Test `packages/style/test/variant.test.ts`.
- `resolveVariant(map, selected, fallback?)`: `selected && selected in map ? map[selected] : fallback && fallback in map ? map[fallback] : undefined`.
- TDD: selected / fallback / missing.

### Task 3: cursor
- Files: `packages/host/src/host.ts` (`Host.setCursor?`), `packages/platform-web/src/create-web-host.ts` (implement via `canvas.style.cursor`), `packages/events/src/pointer-dispatcher.ts` (`onHoverChange?` hook fired on hover-path change), `packages/style/src/style.ts` (+`cursor?: string`), `packages/runtime/src/instance.ts` (`Instance.cursor?`), `packages/primitives/src/box.ts`/`flex.ts`/`text.ts` (set `instance.cursor`), `packages/runtime/src/mount.ts` (wire onHoverChange → pick cursor → host.setCursor), tests `packages/events/test/hover-cursor.test.ts`.
- Add a pure picker in mount or events: `cursorOf(path: {cursor?:string}[]): string` = first defined cursor from target→root, else `'default'`.
- pointer-dispatcher: where `syncHover` computes the new hover path and it differs, call `hooks.onHoverChange?.(newPath)`.
- mount: pass `onHoverChange: (path) => host.setCursor?.(cursorOf(path))` in the dispatcher hooks (alongside existing `onPointerDown`).
- TDD: dispatcher fires onHoverChange with the path when hovering a node; `cursorOf` picks the target's cursor over ancestors.

### Task 4: pointerEvents + userSelect
- Files: `packages/style/src/style.ts` (+`pointerEvents?: 'auto'|'none'`, `userSelect?: 'auto'|'none'|'text'`), `packages/events/src/event.ts` (`HitNode.pointerEvents?`), `packages/events/src/hit-test.ts` (skip subtree when `'none'`), `packages/runtime/src/instance.ts` (`Instance.pointerEvents?`, `userSelect?`), `packages/primitives/src/box.ts`/`flex.ts`/`text.ts` (set from style), test `packages/events/test/pointer-events.test.ts`.
- hit-test `hitAt`: at the top, `if (node.pointerEvents === 'none') return null;` (skip node + subtree → pointers pass through).
- TDD: an overlay Box (`pointerEvents:'none'`) covering a button → hitTest returns the button beneath, not the overlay.

### Task 5: doc flip + verify
- Flip `docs/styling-and-capabilities.md`: §9 `cursor` ✅, `pointerEvents: none` ✅, `userSelect` (typed, inert — note); §11 live light/dark ✅, tokens ✅, variants ✅. Update snapshot (ThemeProvider reactive, resolveVariant, cursor/pointerEvents/userSelect fields). Full `pnpm test` + `pnpm typecheck` green.

---

## Self-review
- Coverage: reactive theme (T1), variant/tokens (T2), cursor (T3), pointerEvents/userSelect (T4), doc (T5).
- Backward-compat: `themeContext` type change is internal (only useTheme/ThemeProvider touch it); static `theme={obj}` still works (normalized to accessor). Default styles: no cursor/pointerEvents → unchanged hit/paint.
- Risk: interactive.ts moving useTheme into resolved() — ensure no infinite loop (resolved is a plain function called by bind's effect; reading useTheme() there tracks theme signal, fine).
