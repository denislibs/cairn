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
