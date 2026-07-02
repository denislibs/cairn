import { test, expect } from 'vitest';
import { useTheme } from '@cairn/style';
import { ThemeProvider, Box, type Instance } from '../src/index';

test('ThemeProvider provides the theme to primitives in its children thunk', () => {
  const theme = { colors: { surface: '#0a0a0a' } };
  let painted = '';
  const inst = ThemeProvider({
    theme,
    children: () => {
      const box = Box({
        style: (t) => ({ width: 4, height: 4, backgroundColor: (t as typeof theme).colors.surface }),
      });
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
