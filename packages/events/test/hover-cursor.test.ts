import { it, expect } from 'vitest';
import { createPointerDispatcher } from '../src/pointer-dispatcher';
import type { HitNode } from '../src/event';

function n(x: number, y: number, w: number, h: number, extra: Partial<HitNode> = {}): HitNode {
  return { layout: { offsetX: x, offsetY: y, size: { w, h } }, children: [], handlers: {}, ...extra };
}

const move = (x: number, y: number) => ({
  type: 'pointermove' as const,
  x,
  y,
  button: 0,
  pointerType: 'mouse' as const,
});

it('fires onHoverChange with the hover path when hovering a node', () => {
  const child = { ...n(0, 0, 50, 50), cursor: 'pointer' } as HitNode & { cursor: string };
  const root: HitNode = { ...n(0, 0, 100, 100), children: [child] };

  const paths: HitNode[][] = [];
  const d = createPointerDispatcher(() => root, {
    onHoverChange: (p: HitNode[]) => paths.push(p),
  });

  d.handlePointer(move(10, 10));

  expect(paths.length).toBeGreaterThan(0);
  const last = paths[paths.length - 1];
  expect(last[0]).toBe(child); // target-first path
});

it('fires onHoverChange when hover target changes', () => {
  const childA = n(0, 0, 50, 100);
  const childB = n(50, 0, 50, 100);
  const root: HitNode = { ...n(0, 0, 100, 100), children: [childA, childB] };

  const paths: HitNode[][] = [];
  const d = createPointerDispatcher(() => root, {
    onHoverChange: (p: HitNode[]) => paths.push(p),
  });

  d.handlePointer(move(10, 10)); // over childA
  d.handlePointer(move(60, 10)); // over childB

  expect(paths.length).toBe(2);
  expect(paths[0][0]).toBe(childA);
  expect(paths[1][0]).toBe(childB);
});

it('does not fire onHoverChange when hover target does not change', () => {
  const child = n(0, 0, 50, 50);
  const root: HitNode = { ...n(0, 0, 100, 100), children: [child] };

  const paths: HitNode[][] = [];
  const d = createPointerDispatcher(() => root, {
    onHoverChange: (p: HitNode[]) => paths.push(p),
  });

  d.handlePointer(move(10, 10)); // over child
  d.handlePointer(move(20, 20)); // still over child

  expect(paths.length).toBe(1); // only once
});
