import { test, expect } from 'vitest';
import { createPointerDispatcher, nearestCommonAncestor } from '../src/index';
import type { HitNode, PointerInput } from '../src/index';

// root(100x100) > [ A(0,0 50x100) > a1(0,0 50x50), B(50,0 50x100) > b1(0,0 50x50) ]
function tree() {
  const log: string[] = [];
  const leaf = (tag: string, w: number, h: number, ox = 0, oy = 0): HitNode => ({
    layout: { offsetX: ox, offsetY: oy, size: { w, h } },
    children: [],
    handlers: {
      onPointerDown: () => log.push(`down:${tag}`),
      onPointerUp: () => log.push(`up:${tag}`),
      onClick: () => log.push(`click:${tag}`),
    },
  });
  const a1 = leaf('a1', 50, 50);
  const b1 = leaf('b1', 50, 50);
  const A: HitNode = { layout: { offsetX: 0, offsetY: 0, size: { w: 50, h: 100 } }, children: [a1], handlers: { onClick: () => log.push('click:A') } };
  const B: HitNode = { layout: { offsetX: 50, offsetY: 0, size: { w: 50, h: 100 } }, children: [b1], handlers: { onClick: () => log.push('click:B') } };
  const root: HitNode = { layout: { offsetX: 0, offsetY: 0, size: { w: 100, h: 100 } }, children: [A, B], handlers: { onClick: () => log.push('click:root') } };
  return { root, A, B, a1, b1, log };
}

const at = (type: PointerInput['type'], x: number, y: number): PointerInput => ({
  type, x, y, button: 0, pointerType: 'mouse',
});

test('nearestCommonAncestor returns the deepest shared node', () => {
  const root: HitNode = { layout: { offsetX: 0, offsetY: 0, size: { w: 1, h: 1 } }, children: [] };
  const mid: HitNode = { layout: { offsetX: 0, offsetY: 0, size: { w: 1, h: 1 } }, children: [] };
  const a: HitNode = { layout: { offsetX: 0, offsetY: 0, size: { w: 1, h: 1 } }, children: [] };
  const b: HitNode = { layout: { offsetX: 0, offsetY: 0, size: { w: 1, h: 1 } }, children: [] };
  expect(nearestCommonAncestor([a, mid, root], [b, mid, root])).toBe(mid);
});

test('down + up on the same target synthesizes a click on it', () => {
  const { root, log } = tree();
  const d = createPointerDispatcher(() => root);
  d.handlePointer(at('pointerdown', 10, 10));
  d.handlePointer(at('pointerup', 10, 10));
  expect(log).toEqual(['down:a1', 'up:a1', 'click:a1', 'click:A', 'click:root']);
});

test('down and up in different subtrees clicks their common ancestor', () => {
  const { root, log } = tree();
  const d = createPointerDispatcher(() => root);
  d.handlePointer(at('pointerdown', 10, 10)); // a1
  log.length = 0;
  d.handlePointer(at('pointerup', 60, 10)); // b1
  expect(log).toEqual(['up:b1', 'click:root']);
});

test('pointerup with no prior down does not synthesize a click', () => {
  const { root, log } = tree();
  const d = createPointerDispatcher(() => root);
  d.handlePointer(at('pointerup', 10, 10));
  expect(log).toEqual(['up:a1']);
});

test('pointer events that miss everything are ignored', () => {
  const { root, log } = tree();
  const d = createPointerDispatcher(() => root);
  d.handlePointer(at('pointerdown', 999, 999));
  expect(log).toEqual([]);
});

test('handleWheel dispatches onWheel along the hit path', () => {
  const wheelLog: string[] = [];
  const leaf: HitNode = {
    layout: { offsetX: 0, offsetY: 0, size: { w: 100, h: 100 } },
    children: [],
    handlers: { onWheel: () => wheelLog.push('wheel') },
  };
  const d = createPointerDispatcher(() => leaf);
  d.handleWheel({ x: 10, y: 10, deltaX: 0, deltaY: 4 });
  expect(wheelLog).toEqual(['wheel']);
});
