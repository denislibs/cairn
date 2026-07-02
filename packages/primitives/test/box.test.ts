import { test, expect } from 'vitest';
import { BoxNode } from '@cairn/layout';
import { Box } from '../src/index';
import { createFakeRenderer, fakeCtx, LOOSE } from './fake';

test('Box builds a BoxNode with explicit size and paints its background', () => {
  const box = Box({ style: { width: 100, height: 40, backgroundColor: '#abc', borderRadius: 8 } });
  box.layout.layout(LOOSE, fakeCtx);
  expect(box.layout.size).toEqual({ w: 100, h: 40 });

  const r = createFakeRenderer();
  box.paintSelf(r);
  expect(r.calls).toContainEqual([
    'fillRoundRect',
    { x: 0, y: 0, width: 100, height: 40 },
    8,
    { color: '#abc' },
  ]);
});

test('Box with no background paints nothing', () => {
  const box = Box({ style: { width: 10, height: 10 } });
  box.layout.layout(LOOSE, fakeCtx);
  const r = createFakeRenderer();
  box.paintSelf(r);
  expect(r.calls).toEqual([]);
});

test('Box links a single child into layout and instance trees', () => {
  const child = Box({ style: { width: 10, height: 10 } });
  const box = Box({ style: { padding: 5 }, children: child });
  expect(box.children).toEqual([child]);
  expect((box.layout as BoxNode).children[0]).toBe(child.layout);
  box.layout.layout(LOOSE, fakeCtx);
  expect(child.layout.offsetX).toBe(5);
  expect(child.layout.offsetY).toBe(5);
});
