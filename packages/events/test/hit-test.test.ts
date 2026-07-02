import { test, expect } from 'vitest';
import { hitTest } from '../src/index';
import type { HitNode } from '../src/index';

// root(100x100) > [ A(0,0 50x100) > a1(0,0 50x50), B(50,0 50x100) > b1(0,0 50x50) ]
function tree() {
  const a1: HitNode = { layout: { offsetX: 0, offsetY: 0, size: { w: 50, h: 50 } }, children: [] };
  const b1: HitNode = { layout: { offsetX: 0, offsetY: 0, size: { w: 50, h: 50 } }, children: [] };
  const A: HitNode = { layout: { offsetX: 0, offsetY: 0, size: { w: 50, h: 100 } }, children: [a1] };
  const B: HitNode = { layout: { offsetX: 50, offsetY: 0, size: { w: 50, h: 100 } }, children: [b1] };
  const root: HitNode = { layout: { offsetX: 0, offsetY: 0, size: { w: 100, h: 100 } }, children: [A, B] };
  return { root, A, B, a1, b1 };
}

test('returns [target ... root] bubble path for a nested hit', () => {
  const { root, A, a1 } = tree();
  expect(hitTest(root, 10, 10)).toEqual([a1, A, root]);
});

test('descends into the correct sibling by absolute offset', () => {
  const { root, B, b1 } = tree();
  expect(hitTest(root, 60, 10)).toEqual([b1, B, root]);
});

test('topmost (later-painted) overlapping sibling wins', () => {
  const under: HitNode = { layout: { offsetX: 0, offsetY: 0, size: { w: 100, h: 100 } }, children: [] };
  const over: HitNode = { layout: { offsetX: 0, offsetY: 0, size: { w: 100, h: 100 } }, children: [] };
  const root: HitNode = { layout: { offsetX: 0, offsetY: 0, size: { w: 100, h: 100 } }, children: [under, over] };
  expect(hitTest(root, 50, 50)).toEqual([over, root]);
});

test('a miss on the root returns []', () => {
  const { root } = tree();
  expect(hitTest(root, 999, 999)).toEqual([]);
});

test('a point inside root but outside all children returns [root]', () => {
  const child: HitNode = { layout: { offsetX: 0, offsetY: 0, size: { w: 10, h: 10 } }, children: [] };
  const root: HitNode = { layout: { offsetX: 0, offsetY: 0, size: { w: 100, h: 100 } }, children: [child] };
  expect(hitTest(root, 90, 90)).toEqual([root]);
});
