import { test, expect } from 'vitest';
import type { HitNode, EventHandlers, CairnPointerEvent } from '../src/index';

function node(handlers?: EventHandlers, children: HitNode[] = []): HitNode {
  return { layout: { offsetX: 0, offsetY: 0, size: { w: 10, h: 10 } }, children, handlers };
}

test('HitNode carries structural layout + optional handlers', () => {
  const n = node();
  expect(n.layout.size.w).toBe(10);
  expect(n.children).toEqual([]);
  expect(n.handlers).toBeUndefined();
});

test('EventHandlers accepts pointer + wheel callbacks', () => {
  const seen: string[] = [];
  const handlers: EventHandlers = {
    onClick: (e: CairnPointerEvent) => seen.push(e.type),
  };
  const parent = node(handlers, [node()]);
  expect(parent.handlers?.onClick).toBeTypeOf('function');
});
