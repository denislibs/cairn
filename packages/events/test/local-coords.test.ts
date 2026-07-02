import { test, expect } from 'vitest';
import { createPointerDispatcher } from '../src/index';
import type { HitNode, PointerInput, CairnPointerEvent } from '../src/index';

// root(100x100) > child at offset (20,10), size 50x50.
function tree() {
  let seen: CairnPointerEvent | undefined;
  const child: HitNode = {
    layout: { offsetX: 20, offsetY: 10, size: { w: 50, h: 50 } },
    children: [],
    handlers: { onPointerDown: (e) => (seen = e) },
  };
  const root: HitNode = { layout: { offsetX: 0, offsetY: 0, size: { w: 100, h: 100 } }, children: [child] };
  return { root, get seen() { return seen; } };
}

const down = (x: number, y: number): PointerInput => ({ type: 'pointerdown', x, y, button: 0, pointerType: 'mouse' });

test('localX/localY are the pointer position relative to the target top-left', () => {
  const t = tree();
  const d = createPointerDispatcher(() => t.root);
  d.handlePointer(down(30, 25)); // inside child (abs 20,10)
  expect(t.seen?.x).toBe(30);
  expect(t.seen?.y).toBe(25);
  expect(t.seen?.localX).toBe(10);
  expect(t.seen?.localY).toBe(15);
});
