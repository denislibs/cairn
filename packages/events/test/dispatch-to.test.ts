import { test, expect } from 'vitest';
import { dispatchTo } from '../src/index';
import type { HitNode, CairnPointerEvent } from '../src/index';

function node(handlers?: HitNode['handlers']): HitNode {
  return { layout: { offsetX: 0, offsetY: 0, size: { w: 10, h: 10 } }, children: [], handlers };
}

test('dispatchTo invokes only the given node handler with target set', () => {
  let seen: CairnPointerEvent | undefined;
  const n = node({ onPointerEnter: (e) => (seen = e) });
  dispatchTo(n, { type: 'pointerenter', x: 1, y: 2, button: 0, pointerType: 'mouse' });
  expect(seen?.type).toBe('pointerenter');
  expect(seen?.target).toBe(n);
  expect(seen?.x).toBe(1);
});

test('dispatchTo maps pointerleave to onPointerLeave', () => {
  const log: string[] = [];
  const n = node({ onPointerLeave: () => log.push('leave') });
  dispatchTo(n, { type: 'pointerleave', x: 0, y: 0, button: 0, pointerType: 'mouse' });
  expect(log).toEqual(['leave']);
});

test('dispatchTo is a no-op when the node lacks the handler', () => {
  const n = node({ onPointerEnter: () => {} });
  expect(() =>
    dispatchTo(n, { type: 'pointerleave', x: 0, y: 0, button: 0, pointerType: 'mouse' }),
  ).not.toThrow();
});
