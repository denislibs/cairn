import { test, expect } from 'vitest';
import { TextNode } from '@cairn/layout';
import { createRoot, createSignal } from '@cairn/reactivity';
import { setFrameRequester } from '@cairn/runtime';
import { Text } from '../src/index';
import { createFakeRenderer, fakeCtx, LOOSE } from './fake';

test('Text renders static content and paints drawText with style', () => {
  const t = Text({ children: 'hi', style: { font: '20px sans-serif', color: '#111' } });
  t.layout.layout(LOOSE, fakeCtx);
  expect((t.layout as TextNode).text).toBe('hi');

  const r = createFakeRenderer();
  t.paintSelf(r);
  expect(r.calls).toContainEqual([
    'drawText',
    'hi',
    { x: 0, y: 0 },
    { font: '20px sans-serif', color: '#111', align: 'left', baseline: 'top' },
  ]);
});

test('Text accepts a value prop (takes precedence over children)', () => {
  const t = Text({ value: 'from-value', children: 'from-children' });
  t.layout.layout(LOOSE, fakeCtx);
  expect((t.layout as TextNode).text).toBe('from-value');
});

test('Text coerces numbers to strings', () => {
  const t = Text({ children: 7 });
  t.layout.layout(LOOSE, fakeCtx);
  expect((t.layout as TextNode).text).toBe('7');
});

test('Text reactive content updates on signal change', () => {
  setFrameRequester(() => {});
  const [n, setN] = createSignal(1);
  let t!: ReturnType<typeof Text>;
  const dispose = createRoot((d) => {
    t = Text({ children: () => String(n()) });
    return d;
  });
  expect((t.layout as TextNode).text).toBe('1');
  setN(2);
  expect((t.layout as TextNode).text).toBe('2');
  dispose();
  setFrameRequester(null);
});
