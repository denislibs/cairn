import { test, expect } from 'vitest';
import { hitTest } from '../src/index';
import type { HitNode } from '../src/index';

// Two overlapping children: 'early' has higher zIndex but is earlier in document order.
// After zIndex ordering, 'early' (z=2) should be painted after 'late' (z=1), so hit first.
test('higher-zIndex child wins hit even if earlier in document order', () => {
  const early: HitNode = {
    layout: { offsetX: 0, offsetY: 0, size: { w: 100, h: 100 }, zIndex: 2 },
    children: [],
  };
  const late: HitNode = {
    layout: { offsetX: 0, offsetY: 0, size: { w: 100, h: 100 }, zIndex: 1 },
    children: [],
  };
  const root: HitNode = {
    layout: { offsetX: 0, offsetY: 0, size: { w: 100, h: 100 }, zIndex: 0 },
    children: [early, late],
  };
  const path = hitTest(root, 50, 50);
  expect(path[0]).toBe(early);
});

test('equal zIndex preserves document order (later-painted wins)', () => {
  const first: HitNode = {
    layout: { offsetX: 0, offsetY: 0, size: { w: 100, h: 100 }, zIndex: 0 },
    children: [],
  };
  const second: HitNode = {
    layout: { offsetX: 0, offsetY: 0, size: { w: 100, h: 100 }, zIndex: 0 },
    children: [],
  };
  const root: HitNode = {
    layout: { offsetX: 0, offsetY: 0, size: { w: 100, h: 100 }, zIndex: 0 },
    children: [first, second],
  };
  const path = hitTest(root, 50, 50);
  // second is later in document order, so it's painted on top and should be hit first
  expect(path[0]).toBe(second);
});
