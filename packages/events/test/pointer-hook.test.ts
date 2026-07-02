import { test, expect } from 'vitest';
import { createPointerDispatcher } from '../src/index';
import type { HitNode, PointerInput } from '../src/index';

const root: HitNode = { layout: { offsetX: 0, offsetY: 0, size: { w: 100, h: 100 } }, children: [] };
const down = (x: number, y: number): PointerInput => ({ type: 'pointerdown', x, y, button: 0, pointerType: 'mouse' });

test('onPointerDown hook fires with the hit path on pointerdown', () => {
  const paths: HitNode[][] = [];
  const d = createPointerDispatcher(() => root, { onPointerDown: (p) => paths.push(p) });
  d.handlePointer(down(10, 10));
  expect(paths).toEqual([[root]]);
});

test('onPointerDown hook fires with an empty path when the pointer misses (for blur)', () => {
  const paths: HitNode[][] = [];
  const d = createPointerDispatcher(() => root, { onPointerDown: (p) => paths.push(p) });
  d.handlePointer(down(999, 999));
  expect(paths).toEqual([[]]);
});

test('hook does not fire on pointermove/up', () => {
  const paths: HitNode[][] = [];
  const d = createPointerDispatcher(() => root, { onPointerDown: (p) => paths.push(p) });
  d.handlePointer({ type: 'pointermove', x: 10, y: 10, button: 0, pointerType: 'mouse' });
  d.handlePointer({ type: 'pointerup', x: 10, y: 10, button: 0, pointerType: 'mouse' });
  expect(paths).toEqual([]);
});
