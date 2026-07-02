import { test, expect } from 'vitest';
import { createPointerDispatcher } from '../src/index';
import type { HitNode, PointerInput } from '../src/index';

// root(100x100) > [ A(0,0 50x100) > a1(0,0 50x50), B(50,0 50x100) > b1(0,0 50x50) ]
function tree() {
  const log: string[] = [];
  const leaf = (tag: string, w: number, h: number, ox = 0, oy = 0): HitNode => ({
    layout: { offsetX: ox, offsetY: oy, size: { w, h } },
    children: [],
    handlers: {
      onPointerEnter: () => log.push(`enter:${tag}`),
      onPointerLeave: () => log.push(`leave:${tag}`),
    },
  });
  const a1 = leaf('a1', 50, 50);
  const b1 = leaf('b1', 50, 50);
  const A: HitNode = { layout: { offsetX: 0, offsetY: 0, size: { w: 50, h: 100 } }, children: [a1], handlers: { onPointerEnter: () => log.push('enter:A'), onPointerLeave: () => log.push('leave:A') } };
  const B: HitNode = { layout: { offsetX: 50, offsetY: 0, size: { w: 50, h: 100 } }, children: [b1], handlers: { onPointerEnter: () => log.push('enter:B'), onPointerLeave: () => log.push('leave:B') } };
  const root: HitNode = { layout: { offsetX: 0, offsetY: 0, size: { w: 100, h: 100 } }, children: [A, B], handlers: { onPointerEnter: () => log.push('enter:root'), onPointerLeave: () => log.push('leave:root') } };
  return { root, log };
}

const move = (x: number, y: number): PointerInput => ({
  type: 'pointermove', x, y, button: 0, pointerType: 'mouse',
});

test('entering a nested node fires enter for the whole path', () => {
  const { root, log } = tree();
  const d = createPointerDispatcher(() => root);
  d.handlePointer(move(10, 10)); // over a1
  expect(log).toEqual(['enter:a1', 'enter:A', 'enter:root']);
});

test('moving to a sibling leaves the old branch and enters the new; shared ancestor stays', () => {
  const { root, log } = tree();
  const d = createPointerDispatcher(() => root);
  d.handlePointer(move(10, 10)); // a1
  log.length = 0;
  d.handlePointer(move(60, 10)); // b1
  expect(log).toEqual(['leave:a1', 'leave:A', 'enter:b1', 'enter:B']); // root neither leaves nor re-enters
});

test('moving off the tree leaves every hovered node', () => {
  const { root, log } = tree();
  const d = createPointerDispatcher(() => root);
  d.handlePointer(move(10, 10)); // a1
  log.length = 0;
  d.handlePointer(move(-1, -1)); // off-surface
  expect(log).toEqual(['leave:a1', 'leave:A', 'leave:root']);
});

test('staying over the same node fires nothing on repeat move', () => {
  const { root, log } = tree();
  const d = createPointerDispatcher(() => root);
  d.handlePointer(move(10, 10));
  log.length = 0;
  d.handlePointer(move(12, 12)); // still a1
  expect(log).toEqual([]);
});
