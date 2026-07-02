import { test, expect } from 'vitest';
import { useTheme } from '@cairn/style';
import { ThemeProvider, Box } from '../src/index';
import { createFakeRenderer } from './fake';

test('ThemeProvider provides the theme to primitives in its children thunk', () => {
  const theme = { colors: { surface: '#0a0a0a' } };
  let color = '';
  const inst = ThemeProvider({
    theme,
    children: () => {
      const box = Box({
        style: (t) => ({ width: 4, height: 4, backgroundColor: (t as typeof theme).colors.surface }),
      });
      const r = createFakeRenderer();
      box.paintSelf(r);
      const call = r.calls.find((c) => c[0] === 'fillRoundRect');
      color = (call?.[3] as { color: string }).color;
      return box;
    },
  });
  expect(color).toBe('#0a0a0a');
  expect(inst.layout).toBeDefined(); // ThemeProvider returns the children's Instance
});

test('useTheme outside a ThemeProvider returns the empty default', () => {
  expect(useTheme()).toEqual({});
});
