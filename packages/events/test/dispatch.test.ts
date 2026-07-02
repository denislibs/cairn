import { test, expect } from 'vitest';
import { dispatch, dispatchWheel } from '../src/index';
import type { HitNode, CairnPointerEvent } from '../src/index';

function node(tag: string, log: string[], stopOn?: string): HitNode {
  return {
    layout: { offsetX: 0, offsetY: 0, size: { w: 10, h: 10 } },
    children: [],
    handlers: {
      onClick: (e: CairnPointerEvent) => {
        log.push(tag);
        if (tag === stopOn) e.stopPropagation();
      },
    },
  };
}

test('handlers fire in bubble order (target -> root)', () => {
  const log: string[] = [];
  const target = node('target', log);
  const mid = node('mid', log);
  const root = node('root', log);
  dispatch([target, mid, root], { type: 'click', x: 0, y: 0, button: 0, pointerType: 'mouse' });
  expect(log).toEqual(['target', 'mid', 'root']);
});

test('stopPropagation halts bubbling', () => {
  const log: string[] = [];
  const target = node('target', log, 'target');
  const mid = node('mid', log);
  const root = node('root', log);
  dispatch([target, mid, root], { type: 'click', x: 0, y: 0, button: 0, pointerType: 'mouse' });
  expect(log).toEqual(['target']);
});

test('target is path[0] and event carries coordinates', () => {
  let seen: CairnPointerEvent | undefined;
  const target: HitNode = {
    layout: { offsetX: 0, offsetY: 0, size: { w: 10, h: 10 } },
    children: [],
    handlers: { onPointerDown: (e) => (seen = e) },
  };
  dispatch([target], { type: 'pointerdown', x: 3, y: 4, button: 0, pointerType: 'mouse' });
  expect(seen?.target).toBe(target);
  expect(seen?.x).toBe(3);
  expect(seen?.y).toBe(4);
});

test('empty path is a no-op', () => {
  expect(() => dispatch([], { type: 'click', x: 0, y: 0, button: 0, pointerType: 'mouse' })).not.toThrow();
});

test('dispatchWheel calls onWheel in bubble order', () => {
  const log: string[] = [];
  const mk = (tag: string): HitNode => ({
    layout: { offsetX: 0, offsetY: 0, size: { w: 10, h: 10 } },
    children: [],
    handlers: { onWheel: () => log.push(tag) },
  });
  dispatchWheel([mk('a'), mk('b')], { x: 0, y: 0, deltaX: 0, deltaY: 5 });
  expect(log).toEqual(['a', 'b']);
});
