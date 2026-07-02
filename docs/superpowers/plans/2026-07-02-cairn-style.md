# Cairn Styling (@cairn/style) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build Cairn's styling system: a unified `Style` type with nested state variants, `StyleSheet.create`, a `resolveStyle` engine (array cascade + state merge), theme tokens with `ThemeProvider`/`useTheme`, and integration into the primitives. Interactive state activation is Phase 7.

**Architecture:** A DOM-free `@cairn/style` package holds the `Style` types, `StyleSheet.create` (typed registry), `resolveStyle` (flatten arrays + merge base then active-state variants in a fixed precedence), and theme (`createTheme` + a `themeContext` over Phase-5 Context + `useTheme`). Primitives accept a `StyleInput` (`Style | Style[] | (theme) => ...`), resolve it against `useTheme()` at construction, and map the flat result to layout/paint. `ThemeProvider` (runtime `Provider` wrapper) lives in primitives.

**Tech Stack:** TypeScript (strict, `lib: ES2022`, no DOM), pnpm workspaces, Vitest. `@cairn/style` depends on `@cairn/layout` (geometry/enum types) + `@cairn/reactivity` (context).

---

## File Structure

```
package.json                              # MODIFY: typecheck adds @cairn/style
packages/style/
  package.json                            # deps: layout, reactivity
  tsconfig.json
  src/
    style.ts                              # StateName, STATE_ORDER, BaseStyle, Style
    stylesheet.ts                         # StyleSheet.create
    resolve.ts                            # resolveStyle
    theme.ts                              # createTheme, themeContext, useTheme
    index.ts
  test/
    style.test.ts                         # StyleSheet.create + Style typing
    resolve.test.ts                       # resolveStyle
    theme.test.ts                         # createTheme / useTheme
packages/primitives/
  package.json                            # MODIFY: add @cairn/style dep
  src/
    resolve-input.ts                      # StyleInput + resolveStyleInput
    box.ts, text.ts, flex.ts              # MODIFY: accept StyleInput, resolve via useTheme
    theme-provider.ts                     # ThemeProvider
    index.ts                              # MODIFY exports
  test/
    style-integration.test.ts            # array + theme-fn through primitives
    theme-provider.test.ts
examples/themed-cards/                    # manual browser check
  index.html, main.tsx, vite.config.ts
```

---

## Task 1: @cairn/style scaffold + Style types + StyleSheet

**Files:**
- Create: `packages/style/package.json`, `packages/style/tsconfig.json`
- Create: `packages/style/src/style.ts`, `packages/style/src/stylesheet.ts`, `packages/style/src/index.ts`
- Modify: `package.json` (root typecheck)
- Test: `packages/style/test/style.test.ts`

- [ ] **Step 1: Write the failing test**

`packages/style/test/style.test.ts`:
```ts
import { test, expect } from 'vitest';
import { StyleSheet, STATE_ORDER, type Style } from '../src/index';

test('StyleSheet.create returns the same object (typed registry)', () => {
  const styles = StyleSheet.create({
    card: { backgroundColor: '#fff', borderRadius: 8, hover: { backgroundColor: '#eee' } },
  });
  expect(styles.card.backgroundColor).toBe('#fff');
  expect(styles.card.hover?.backgroundColor).toBe('#eee');
});

test('STATE_ORDER lists states with disabled last (highest precedence)', () => {
  expect(STATE_ORDER).toEqual(['hover', 'focus', 'active', 'pressed', 'disabled']);
});

test('a Style can carry nested state variants', () => {
  const s: Style = { width: 10, hover: { width: 20 }, disabled: { color: '#999' } };
  expect(s.width).toBe(10);
  expect(s.hover?.width).toBe(20);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run packages/style/test/style.test.ts`
Expected: FAIL — cannot resolve `../src/index`.

- [ ] **Step 3: Create the package files**

`packages/style/package.json`:
```json
{
  "name": "@cairn/style",
  "version": "0.0.0",
  "type": "module",
  "main": "./src/index.ts",
  "module": "./src/index.ts",
  "types": "./src/index.ts",
  "exports": {
    ".": "./src/index.ts"
  },
  "sideEffects": false,
  "dependencies": {
    "@cairn/layout": "workspace:*",
    "@cairn/reactivity": "workspace:*"
  }
}
```

`packages/style/tsconfig.json`:
```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist"
  },
  "include": ["src", "test"]
}
```

`packages/style/src/style.ts`:
```ts
import type { EdgeInsets, Justify, Align } from '@cairn/layout';

export type StateName = 'hover' | 'focus' | 'active' | 'pressed' | 'disabled';

// Fixed precedence: later states override earlier ones (disabled wins).
export const STATE_ORDER: readonly StateName[] = ['hover', 'focus', 'active', 'pressed', 'disabled'];

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

`packages/style/src/stylesheet.ts`:
```ts
import type { Style } from './style';

export const StyleSheet = {
  // Typed registry. Identity today; a home for future caching/validation.
  create<T extends Record<string, Style>>(styles: T): T {
    return styles;
  },
};
```

`packages/style/src/index.ts`:
```ts
export type { StateName, BaseStyle, Style } from './style';
export { STATE_ORDER } from './style';
export { StyleSheet } from './stylesheet';
```

- [ ] **Step 4: Update root typecheck + install**

Modify root `package.json` `scripts.typecheck` to append the style project at the END:
```json
    "typecheck": "tsc --noEmit -p packages/reactivity/tsconfig.json && tsc --noEmit -p packages/host/tsconfig.json && tsc --noEmit -p packages/platform-web/tsconfig.json && tsc --noEmit -p packages/layout/tsconfig.json && tsc --noEmit -p packages/runtime/tsconfig.json && tsc --noEmit -p packages/primitives/tsconfig.json && tsc --noEmit -p packages/style/tsconfig.json"
```

Run: `pnpm install`
Expected: no errors; `@cairn/layout` + `@cairn/reactivity` symlinked into `@cairn/style`.

- [ ] **Step 5: Run test + typecheck**

Run: `pnpm vitest run packages/style/test/style.test.ts`
Expected: PASS (3 tests).

Run: `pnpm typecheck`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(style): scaffold @cairn/style with Style types and StyleSheet.create"
```

---

## Task 2: resolveStyle

**Files:**
- Create: `packages/style/src/resolve.ts`
- Modify: `packages/style/src/index.ts`
- Test: `packages/style/test/resolve.test.ts`

- [ ] **Step 1: Write the failing test**

`packages/style/test/resolve.test.ts`:
```ts
import { test, expect } from 'vitest';
import { resolveStyle } from '../src/index';

test('base only: returns the base props', () => {
  expect(resolveStyle({ width: 10, backgroundColor: '#f00' })).toEqual({
    width: 10,
    backgroundColor: '#f00',
  });
});

test('resolved result never contains state keys', () => {
  const out = resolveStyle({ width: 10, hover: { width: 20 } });
  expect(out).toEqual({ width: 10 });
  expect('hover' in out).toBe(false);
});

test('array cascade: later styles win; undefined does not overwrite', () => {
  const out = resolveStyle([
    { width: 10, backgroundColor: '#111' },
    { backgroundColor: '#222', height: 20 },
  ]);
  expect(out).toEqual({ width: 10, backgroundColor: '#222', height: 20 });
});

test('single active state is merged over the base', () => {
  const out = resolveStyle({ backgroundColor: 'blue', hover: { backgroundColor: 'navy' } }, ['hover']);
  expect(out.backgroundColor).toBe('navy');
});

test('inactive states are ignored', () => {
  const out = resolveStyle({ backgroundColor: 'blue', hover: { backgroundColor: 'navy' } }, ['focus']);
  expect(out.backgroundColor).toBe('blue');
});

test('multiple active states apply in fixed precedence (disabled wins)', () => {
  const out = resolveStyle(
    {
      backgroundColor: 'blue',
      hover: { backgroundColor: 'navy' },
      disabled: { backgroundColor: 'gray' },
    },
    ['disabled', 'hover'], // order in the set does not matter
  );
  expect(out.backgroundColor).toBe('gray'); // disabled has highest precedence
});

test('state variants cascade across an array in precedence order', () => {
  const out = resolveStyle(
    [
      { color: 'black', hover: { color: 'blue' } },
      { hover: { color: 'green' } },
    ],
    ['hover'],
  );
  expect(out.color).toBe('green'); // later array entry's hover wins
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run packages/style/test/resolve.test.ts`
Expected: FAIL — `resolveStyle` not exported.

- [ ] **Step 3: Implement resolve.ts**

`packages/style/src/resolve.ts`:
```ts
import { type Style, type BaseStyle, type StateName, STATE_ORDER } from './style';

const STATE_KEYS: ReadonlySet<string> = new Set<string>(STATE_ORDER);

// Merge non-state props from `source` into `target` (later wins; undefined skipped).
function mergeBase(target: Record<string, unknown>, source: Record<string, unknown>): void {
  for (const key of Object.keys(source)) {
    if (STATE_KEYS.has(key)) continue;
    const value = source[key];
    if (value !== undefined) target[key] = value;
  }
}

export function resolveStyle(input: Style | Style[], activeStates?: Iterable<StateName>): BaseStyle {
  const styles = Array.isArray(input) ? input : [input];
  const result: Record<string, unknown> = {};

  // Base pass: merge every style's base props (array cascade, later wins).
  for (const s of styles) mergeBase(result, s as Record<string, unknown>);

  // State pass: for each state in fixed precedence, if active, merge its variant
  // from every style (array order preserved within a state).
  if (activeStates) {
    const active = new Set(activeStates);
    for (const state of STATE_ORDER) {
      if (!active.has(state)) continue;
      for (const s of styles) {
        const variant = s[state];
        if (variant) mergeBase(result, variant as Record<string, unknown>);
      }
    }
  }

  return result as BaseStyle;
}
```

`packages/style/src/index.ts` (append):
```ts
export { resolveStyle } from './resolve';
```

- [ ] **Step 4: Run test + typecheck**

Run: `pnpm vitest run packages/style/test/resolve.test.ts`
Expected: PASS (7 tests).

Run: `pnpm typecheck`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(style): resolveStyle (array cascade + state precedence merge)"
```

---

## Task 3: Theme (createTheme, themeContext, useTheme)

**Files:**
- Create: `packages/style/src/theme.ts`
- Modify: `packages/style/src/index.ts`
- Test: `packages/style/test/theme.test.ts`

- [ ] **Step 1: Write the failing test**

`packages/style/test/theme.test.ts`:
```ts
import { test, expect } from 'vitest';
import { runWithContext } from '@cairn/reactivity';
import { createTheme, themeContext, useTheme } from '../src/index';

test('createTheme returns the tokens (identity, typed)', () => {
  const theme = createTheme({ colors: { primary: '#3b82f6' } });
  expect(theme.colors.primary).toBe('#3b82f6');
});

test('useTheme returns the empty default when no theme is provided', () => {
  expect(useTheme()).toEqual({});
});

test('useTheme returns the provided theme inside a themeContext scope', () => {
  const theme = createTheme({ colors: { primary: '#3b82f6' } });
  let seen: unknown;
  runWithContext(themeContext, theme, () => {
    seen = useTheme();
  });
  expect(seen).toBe(theme);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run packages/style/test/theme.test.ts`
Expected: FAIL — `createTheme` / `themeContext` / `useTheme` not exported.

- [ ] **Step 3: Implement theme.ts**

`packages/style/src/theme.ts`:
```ts
import { createContext, useContext, type Context } from '@cairn/reactivity';

export type Theme = Record<string, unknown>;

// Typed identity — a home for future theme normalization.
export function createTheme<T extends Theme>(tokens: T): T {
  return tokens;
}

export const themeContext: Context<Theme> = createContext<Theme>({});

export function useTheme<T extends Theme = Theme>(): T {
  return useContext(themeContext) as T;
}
```

`packages/style/src/index.ts` (append):
```ts
export { createTheme, themeContext, useTheme } from './theme';
export type { Theme } from './theme';
```

- [ ] **Step 4: Run test + typecheck**

Run: `pnpm vitest run packages/style/test/theme.test.ts`
Expected: PASS (3 tests).

Run: `pnpm vitest run packages/style`
Expected: PASS (style 3 + resolve 7 + theme 3 = 13).

Run: `pnpm typecheck`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(style): theme — createTheme, themeContext, useTheme"
```

---

## Task 4: Primitives integration (StyleInput + Box/Text/Row/Column)

**Files:**
- Create: `packages/primitives/src/resolve-input.ts`
- Modify: `packages/primitives/src/box.ts`, `text.ts`, `flex.ts`, `index.ts`
- Modify: `packages/primitives/package.json` (add `@cairn/style` dep)
- Test: `packages/primitives/test/style-integration.test.ts`

- [ ] **Step 1: Add the `@cairn/style` dependency + install**

In `packages/primitives/package.json`, add `"@cairn/style": "workspace:*"` to `dependencies` (alongside runtime/layout/host):
```json
  "dependencies": {
    "@cairn/runtime": "workspace:*",
    "@cairn/layout": "workspace:*",
    "@cairn/host": "workspace:*",
    "@cairn/style": "workspace:*"
  },
```
Run: `pnpm install`  → no errors.

- [ ] **Step 2: Write the failing test**

`packages/primitives/test/style-integration.test.ts`:
```ts
import { test, expect } from 'vitest';
import { runWithContext } from '@cairn/reactivity';
import { themeContext } from '@cairn/style';
import { Box, Text } from '../src/index';
import { createFakeRenderer, fakeCtx, LOOSE } from './fake';

test('Box accepts an array of styles (later wins)', () => {
  const box = Box({
    style: [
      { width: 10, backgroundColor: '#111' },
      { backgroundColor: '#222', height: 20 },
    ],
  });
  box.layout.layout(LOOSE, fakeCtx);
  expect(box.layout.size).toEqual({ w: 10, h: 20 });
  const r = createFakeRenderer();
  box.paintSelf(r);
  expect(r.calls).toContainEqual([
    'fillRoundRect',
    { x: 0, y: 0, width: 10, height: 20 },
    0,
    { color: '#222' },
  ]);
});

test('Box style function receives the provided theme', () => {
  const theme = { colors: { surface: '#abcdef' } };
  let box!: ReturnType<typeof Box>;
  runWithContext(themeContext, theme, () => {
    box = Box({
      style: (t) => ({ width: 5, height: 5, backgroundColor: (t as typeof theme).colors.surface }),
    });
  });
  const r = createFakeRenderer();
  box.paintSelf(r);
  expect(r.calls).toContainEqual([
    'fillRoundRect',
    { x: 0, y: 0, width: 5, height: 5 },
    0,
    { color: '#abcdef' },
  ]);
});

test('Text style function receives the theme', () => {
  const theme = { text: '#333' };
  let t!: ReturnType<typeof Text>;
  runWithContext(themeContext, theme, () => {
    t = Text({
      children: 'hi',
      style: (th) => ({ color: (th as typeof theme).text, font: '10px sans-serif' }),
    });
  });
  const r = createFakeRenderer();
  t.paintSelf(r);
  expect(r.calls).toContainEqual([
    'drawText',
    'hi',
    { x: 0, y: 0 },
    { font: '10px sans-serif', color: '#333', baseline: 'top' },
  ]);
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `pnpm vitest run packages/primitives/test/style-integration.test.ts`
Expected: FAIL — `Box` does not accept a style function / import errors.

- [ ] **Step 4: Create resolve-input.ts**

`packages/primitives/src/resolve-input.ts`:
```ts
import { resolveStyle, type Style, type BaseStyle, type StateName, type Theme } from '@cairn/style';

export type StyleInput = Style | Style[] | ((theme: Theme) => Style | Style[]);

// Resolve a primitive's style prop against the current theme and active states.
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

- [ ] **Step 5: Rewrite box.ts**

`packages/primitives/src/box.ts` (full file):
```ts
import type { Renderer } from '@cairn/host';
import { BoxNode } from '@cairn/layout';
import { type Instance } from '@cairn/runtime';
import { useTheme } from '@cairn/style';
import { resolveStyleInput, type StyleInput } from './resolve-input';

export interface BoxProps {
  style?: StyleInput;
  children?: Instance;
}

export function Box(props: BoxProps = {}): Instance {
  const s = resolveStyleInput(props.style, useTheme());
  const child = props.children;
  const layout = new BoxNode({
    width: s.width,
    height: s.height,
    padding: s.padding,
    child: child?.layout,
  });
  return {
    layout,
    children: child ? [child] : [],
    paintSelf(r: Renderer) {
      if (s.backgroundColor) {
        r.fillRoundRect(
          { x: 0, y: 0, width: layout.size.w, height: layout.size.h },
          s.borderRadius ?? 0,
          { color: s.backgroundColor },
        );
      }
    },
  };
}
```

- [ ] **Step 6: Rewrite text.ts**

`packages/primitives/src/text.ts` (full file):
```ts
import type { Renderer } from '@cairn/host';
import { TextNode } from '@cairn/layout';
import { type Instance, bind, type MaybeReactive } from '@cairn/runtime';
import { useTheme } from '@cairn/style';
import { resolveStyleInput, type StyleInput } from './resolve-input';

export interface TextProps {
  children?: MaybeReactive<string | number>;
  value?: MaybeReactive<string | number>;
  style?: StyleInput;
}

export function Text(props: TextProps = {}): Instance {
  const s = resolveStyleInput(props.style, useTheme());
  const font = s.font ?? '16px sans-serif';
  const color = s.color ?? '#000';
  const layout = new TextNode({ text: '', style: { font } });
  const content = props.value ?? props.children ?? '';
  bind(content, (v) => {
    layout.text = String(v);
  });
  return {
    layout,
    children: [],
    paintSelf(r: Renderer) {
      r.drawText(layout.text, { x: 0, y: 0 }, { font, color, baseline: 'top' });
    },
  };
}
```

- [ ] **Step 7: Rewrite flex.ts**

`packages/primitives/src/flex.ts` (full file):
```ts
import { FlexNode, type FlexDirection } from '@cairn/layout';
import { type Instance } from '@cairn/runtime';
import { useTheme } from '@cairn/style';
import { resolveStyleInput, type StyleInput } from './resolve-input';

export interface FlexProps {
  style?: StyleInput;
  children?: Instance | Instance[];
}

function flex(direction: FlexDirection, props: FlexProps): Instance {
  const s = resolveStyleInput(props.style, useTheme());
  const children =
    props.children == null ? [] : Array.isArray(props.children) ? props.children : [props.children];
  const layout = new FlexNode({
    direction,
    gap: s.gap,
    justify: s.justify,
    align: s.align,
    children: children.map((c) => c.layout),
  });
  return {
    layout,
    children,
    paintSelf() {
      // containers have no own visuals
    },
  };
}

export function Row(props: FlexProps = {}): Instance {
  return flex('row', props);
}

export function Column(props: FlexProps = {}): Instance {
  return flex('column', props);
}
```

- [ ] **Step 8: Rewrite index.ts** (drop the removed per-primitive Style types; add resolve-input exports)

`packages/primitives/src/index.ts` (full file):
```ts
export { Box } from './box';
export type { BoxProps } from './box';
export { Text } from './text';
export type { TextProps } from './text';
export { Row, Column } from './flex';
export type { FlexProps } from './flex';
export { resolveStyleInput } from './resolve-input';
export type { StyleInput } from './resolve-input';
```

- [ ] **Step 9: Run tests + typecheck**

Run: `pnpm vitest run packages/primitives`
Expected: PASS — existing box/text/flex/counter tests still pass (plain style objects are valid `Style`), plus the 3 new style-integration tests.

Run: `pnpm typecheck`
Expected: no errors.

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "feat(primitives): accept StyleInput (unified Style + theme fn) via @cairn/style"
```

---

## Task 5: ThemeProvider (primitives)

**Files:**
- Create: `packages/primitives/src/theme-provider.ts`
- Modify: `packages/primitives/src/index.ts`
- Test: `packages/primitives/test/theme-provider.test.ts`

- [ ] **Step 1: Write the failing test**

`packages/primitives/test/theme-provider.test.ts`:
```ts
import { test, expect } from 'vitest';
import { useTheme } from '@cairn/style';
import { ThemeProvider, Box, type Instance } from '../src/index';

test('ThemeProvider provides the theme to primitives in its children thunk', () => {
  const theme = { colors: { surface: '#0a0a0a' } };
  let painted = '';
  const inst = ThemeProvider({
    theme,
    children: () => {
      const box = Box({ style: (t) => ({ width: 4, height: 4, backgroundColor: (t as typeof theme).colors.surface }) });
      // capture the resolved background by painting
      const calls: unknown[][] = [];
      box.paintSelf({ fillRoundRect: (_r, _rad, style) => calls.push(['fill', style]) } as never);
      painted = (calls[0][1] as { color: string }).color;
      return box;
    },
  });
  expect(painted).toBe('#0a0a0a');
  expect((inst as Instance).layout).toBeDefined();
});

test('useTheme outside a ThemeProvider returns the empty default', () => {
  expect(useTheme()).toEqual({});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run packages/primitives/test/theme-provider.test.ts`
Expected: FAIL — `ThemeProvider` not exported.

- [ ] **Step 3: Implement theme-provider.ts and export it**

`packages/primitives/src/theme-provider.ts`:
```ts
import { themeContext, type Theme } from '@cairn/style';
import { Provider, type Instance } from '@cairn/runtime';

export interface ThemeProviderProps {
  theme: Theme;
  children: () => Instance;
}

// Provide a theme to a subtree. Like Provider, `children` is a thunk (eager JSX children).
export function ThemeProvider(props: ThemeProviderProps): Instance {
  return Provider({ context: themeContext, value: props.theme, children: props.children });
}
```

`packages/primitives/src/index.ts` (append):
```ts
export { ThemeProvider } from './theme-provider';
export type { ThemeProviderProps } from './theme-provider';
```

- [ ] **Step 4: Run tests + typecheck**

Run: `pnpm vitest run packages/primitives/test/theme-provider.test.ts`
Expected: PASS (2 tests).

Run: `pnpm vitest run packages/primitives`
Expected: PASS (all primitives tests).

Run: `pnpm typecheck`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(primitives): ThemeProvider (themeContext over runtime Provider)"
```

---

## Task 6: Themed-cards example, READMEs, full-workspace green

**Files:**
- Create: `examples/themed-cards/index.html`, `examples/themed-cards/main.tsx`, `examples/themed-cards/vite.config.ts`
- Create: `packages/style/README.md`
- Modify: `packages/primitives/README.md`

- [ ] **Step 1: Create the browser example**

`examples/themed-cards/index.html`:
```html
<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Cairn — themed cards</title>
    <style>
      html, body { margin: 0; height: 100%; }
      #stage { display: block; width: 100vw; height: 100vh; }
    </style>
  </head>
  <body>
    <canvas id="stage"></canvas>
    <script type="module" src="./main.tsx"></script>
  </body>
</html>
```

`examples/themed-cards/main.tsx`:
```tsx
import { createWebHost } from '@cairn/platform-web';
import { mount } from '@cairn/runtime';
import { createTheme, type Theme } from '@cairn/style';
import { ThemeProvider, Box, Column, Text } from '@cairn/primitives';

const canvas = document.getElementById('stage') as HTMLCanvasElement;
const host = createWebHost(canvas);

const theme = createTheme({
  colors: { bg: '#0f172a', surface: '#1e293b', text: '#e2e8f0', accent: '#38bdf8' },
});
type AppTheme = typeof theme;

function Card(title: string, body: string) {
  return Box({
    style: (t) => ({
      backgroundColor: (t as AppTheme).colors.surface,
      borderRadius: 12,
      padding: 20,
      width: 260,
    }),
    children: Column({
      style: { gap: 8 },
      children: [
        Text({ style: (t) => ({ font: 'bold 20px sans-serif', color: (t as AppTheme).colors.accent }), children: title }),
        Text({ style: (t) => ({ font: '15px sans-serif', color: (t as AppTheme).colors.text }), children: body }),
      ],
    }),
  });
}

function App() {
  return (
    <ThemeProvider theme={theme}>
      {() => (
        <Box style={(t) => ({ backgroundColor: (t as AppTheme).colors.bg, padding: 24 })}>
          <Column style={{ gap: 16, align: 'start' }}>
            {[Card('Signals', 'Fine-grained reactivity.'), Card('Layout', 'Constraints down, size up.')]}
          </Column>
        </Box>
      )}
    </ThemeProvider>
  );
}

mount(App, host);
```

`examples/themed-cards/vite.config.ts`:
```ts
import { defineConfig } from 'vite';

export default defineConfig({
  esbuild: {
    jsx: 'automatic',
    jsxImportSource: '@cairn/runtime',
  },
});
```

- [ ] **Step 2: Write the @cairn/style README**

`packages/style/README.md`:
```markdown
# @cairn/style

Styling system for Cairn: a unified `Style` type with nested state variants, a `StyleSheet`
registry, a `resolveStyle` engine, and theme tokens.

## Exports

- `StyleSheet.create(map)` — typed style registry.
- `Style` / `BaseStyle` — a unified style shape (layout + paint props) with nested state
  variants (`hover`, `focus`, `active`, `pressed`, `disabled`).
- `resolveStyle(input, activeStates?)` — flattens `Style | Style[]` (array cascade) and merges
  active state variants in fixed precedence (`hover → focus → active → pressed → disabled`).
- `createTheme(tokens)`, `themeContext`, `useTheme()` — theme tokens over Context.

Live state activation (hover/focus from events) is wired by the primitives + events phase.
```

- [ ] **Step 3: Add a styling note to the primitives README**

Append to `packages/primitives/README.md`:
```markdown

## Styling

Primitives accept `style` as a `Style`, a `Style[]` (cascade), or a `(theme) => Style` function.
Wrap a subtree in `ThemeProvider` to provide theme tokens:

    <ThemeProvider theme={theme}>{() => <App />}</ThemeProvider>

Inside, `style={(t) => ({ backgroundColor: t.colors.surface })}` reads the provided theme.
```

- [ ] **Step 4: Run the full workspace suite + typecheck**

Run: `pnpm vitest run`
Expected: PASS — all packages green (reactivity + host + platform-web + layout + runtime + primitives + style).

Run: `pnpm typecheck`
Expected: no errors across all seven packages.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "docs(style): themed-cards example + READMEs; finalize Phase 6"
```

---

## Self-Review Notes (for the implementer)

- **Spec coverage:** Style types + StyleSheet → Task 1. resolveStyle (cascade + state precedence + no key leak) → Task 2. theme (createTheme/themeContext/useTheme) → Task 3. Primitive `StyleInput` integration (Box/Text/Row/Column resolve via `useTheme`) → Task 4. ThemeProvider → Task 5. Example + READMEs → Task 6.
- **Deferred (per spec):** live state activation + reactive restyle (Phase 7); % units, caching.
- **Backward compatibility:** existing primitive tests pass unchanged because a plain object (e.g. `{ width: 100, backgroundColor: '#f00' }`) is a valid `Style`, and `resolveStyleInput` returns its base props. The per-primitive `BoxStyle`/`TextStyle`/`FlexStyle` interfaces are removed and replaced by the unified `Style`; their index exports are dropped in Task 4's index rewrite.
- **Type consistency:** `Style`/`BaseStyle`/`StateName`/`Theme` come from `@cairn/style` and are used identically in `resolve-input.ts`, primitives, and theme. `resolveStyle(input, activeStates?)` and `resolveStyleInput(input, theme, activeStates?)` signatures match across style/primitives. `themeContext`/`useTheme` are the single shared theme channel used by both `useTheme` (read) and `ThemeProvider` (provide).
- **DOM-free:** `@cairn/style` is a core package (`lib: ES2022`, no DOM), depending only on `@cairn/layout` (types) and `@cairn/reactivity` (context).
```
