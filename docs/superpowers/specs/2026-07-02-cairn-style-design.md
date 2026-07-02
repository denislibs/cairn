# Cairn Phase 6 — Styling (`@cairn/style` + theme + primitives integration) — Design

**Date:** 2026-07-02
**Status:** approved design
**Depends on:** Phase 1 (reactivity), Phase 4 (runtime/primitives), Phase 5 (Context) — merged to main.

## Goal

A styling system: a unified `Style` type with nested state variants, a `StyleSheet.create`
registry, a `resolveStyle` engine (array cascade + state merge), theme tokens with
`ThemeProvider`/`useTheme`, and integration into the primitives. Interactive state activation
(live hover/focus) is wired in Phase 7 (events); Phase 6 builds the engine and static integration.

## Decisions

| Area | Decision |
|---|---|
| Style model | Unified `Style` superset with nested state variants (`hover`/`focus`/`active`/`pressed`/`disabled`) — option A |
| State precedence | Fixed order `hover → focus → active → pressed → disabled` (disabled wins) |
| Cascade | `Style[]` arrays cascade left-to-right (later wins) |
| Theme referencing | `style` may be `(theme) => Style` (also plain `Style`/`Style[]`) |
| Package | new `@cairn/style` (core, DOM-free, depends on reactivity for context) |
| Theme home | `createTheme`/`themeContext`/`useTheme` in `@cairn/style`; `ThemeProvider` (JSX) in `@cairn/primitives` |
| Scope vs events | Engine + theme + static primitive integration now; live state activation + reactive restyle in Phase 7 |

## `@cairn/style`

### Style types (`style.ts`)
```ts
import type { EdgeInsets, Justify, Align } from '@cairn/layout';

export type StateName = 'hover' | 'focus' | 'active' | 'pressed' | 'disabled';

export interface BaseStyle {
  // layout
  width?: number;
  height?: number;
  padding?: number | Partial<EdgeInsets>;
  gap?: number;
  justify?: Justify;
  align?: Align;
  // paint
  backgroundColor?: string;
  borderRadius?: number;
  color?: string;
  font?: string;
}

export type Style = BaseStyle & Partial<Record<StateName, BaseStyle>>;
```

The state precedence order is a module constant: `['hover', 'focus', 'active', 'pressed', 'disabled']`.

### StyleSheet (`stylesheet.ts`)
```ts
export const StyleSheet = {
  create<T extends Record<string, Style>>(styles: T): T {
    return styles; // typed registry (identity; a home for future caching/validation)
  },
};
```

### resolveStyle (`resolve.ts`)
```ts
export function resolveStyle(
  input: Style | Style[],
  activeStates?: Iterable<StateName>,
): BaseStyle;
```
- Normalize `input` to an array. For each style in order, merge its **base** props (excluding
  state keys) into the accumulator (later wins).
- Then, for each state in the fixed precedence order that is present in `activeStates`, merge
  that state's variant (from each style, in array order) into the accumulator.
- The returned `BaseStyle` never contains state keys.
- Merge is a shallow property overwrite (undefined values do not overwrite).

### Theme (`theme.ts`)
```ts
import { createContext, useContext, type Context } from '@cairn/reactivity';

export type Theme = Record<string, unknown>;
export function createTheme<T extends Theme>(tokens: T): T { return tokens; }

export const themeContext: Context<Theme> = createContext<Theme>({});
export function useTheme<T extends Theme = Theme>(): T {
  return useContext(themeContext) as T;
}
```

## Primitives integration (`@cairn/primitives`)

### StyleInput + resolveStyleInput (`resolve-input.ts`)
```ts
import { resolveStyle, type Style, type BaseStyle, type StateName, type Theme } from '@cairn/style';

export type StyleInput = Style | Style[] | ((theme: Theme) => Style | Style[]);

export function resolveStyleInput(
  input: StyleInput | undefined,
  theme: Theme,
  activeStates?: Iterable<StateName>,
): BaseStyle {
  if (input === undefined) return {};
  const styles = typeof input === 'function' ? input(theme) : input;
  return resolveStyle(styles, activeStates);
}
```

### Primitive changes
- `Box`, `Text`, `Row`, `Column` accept `style?: StyleInput` (unified `Style`).
- At construction: `const theme = useTheme(); const s = resolveStyleInput(style, theme);`
  (empty active states in Phase 6). Then map `s` to the layout/paint fields as today:
  - Box: `width/height/padding` → `BoxNode`; `backgroundColor/borderRadius` → paint.
  - Text: `font/color` → paint (font also to `TextNode`).
  - Row/Column: `gap/justify/align` → `FlexNode`.
- Backward compatible: a plain object like `{ width: 100, backgroundColor: '#f00' }` is a valid
  `Style`, so existing usage keeps working.

### ThemeProvider (`theme-provider.ts`)
```ts
import { themeContext, type Theme } from '@cairn/style';
import { Provider } from '@cairn/runtime';
import type { Instance } from '@cairn/runtime';

export interface ThemeProviderProps {
  theme: Theme;
  children: () => Instance;
}
export function ThemeProvider(props: ThemeProviderProps): Instance {
  return Provider({ context: themeContext, value: props.theme, children: props.children });
}
```

## Testing

**@cairn/style:**
- `resolveStyle`: base only; array cascade (later wins; undefined does not overwrite);
  single active state applied; multiple active states in fixed precedence; `disabled` overrides
  `hover`; resolved result has no state keys.
- `StyleSheet.create` returns the same object (identity) and is typed.
- `createTheme` identity.
- `useTheme` returns default (`{}`) with no provider; returns provided theme inside
  `runWithContext(themeContext, theme, ...)`.

**@cairn/primitives:**
- `Box`/`Text` accept a plain `Style`, an array, and a `(theme) => Style` function.
- A `(theme) => Style` primitive inside a `ThemeProvider` reads the provided theme
  (assert the resolved paint uses theme values).
- Resolved style maps to the correct layout/paint (e.g. `backgroundColor` → `fillRoundRect`
  color; `gap` → FlexNode gap).

**Example:** `examples/themed-cards/` — `ThemeProvider` + cards styled via `(theme) => ({...})`;
static (no interaction) manual browser check.

## Exit criteria

- `@cairn/style` (Style/StyleSheet/resolveStyle/theme) built DOM-free; primitives consume
  `StyleInput`; `ThemeProvider`/`useTheme` work over Context.
- `pnpm typecheck` + `pnpm vitest run` green across the workspace.
- State resolution fully covered by resolver tests (precedence, cascade, no key leakage).

## Out of scope (later phases)

- Live state activation (hover/focus/pressed from pointer/focus events) + reactive restyle — Phase 7.
- Percentage/flex units beyond current numbers, advanced cascade/specificity — later.
- Style caching/deduping in `StyleSheet.create` — perf phase.
