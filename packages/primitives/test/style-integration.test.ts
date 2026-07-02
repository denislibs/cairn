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
  box.layout.layout(LOOSE, fakeCtx); // layout runs before paint (as in the real frame)
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
