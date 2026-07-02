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

## Example

```ts
import { StyleSheet, resolveStyle } from '@cairn/style';

const styles = StyleSheet.create({
  button: { backgroundColor: '#3b82f6', borderRadius: 8, hover: { backgroundColor: '#2563eb' } },
});

resolveStyle(styles.button);            // { backgroundColor: '#3b82f6', borderRadius: 8 }
resolveStyle(styles.button, ['hover']); // { backgroundColor: '#2563eb', borderRadius: 8 }
```

Live state activation (hover/focus from events) is wired by the events phase; Phase 6 provides
the engine, theme, and static primitive integration.
