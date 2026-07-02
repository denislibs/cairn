import { test, expect } from 'vitest';
import { BoxNode } from '../src/index';
import type { LayoutContext } from '../src/index';

const ctx: LayoutContext = { measureText: (t) => ({ width: t.length * 7 }) };

test('center alignment offsets the child within a larger box', () => {
  const box = new BoxNode({ width: 100, height: 60, alignX: 'center', alignY: 'center', child: new BoxNode({ width: 20, height: 20 }) });
  box.layout({ minW: 0, maxW: 200, minH: 0, maxH: 200 }, ctx);
  const child = box.children[0];
  expect(child.offsetX).toBe(40);
  expect(child.offsetY).toBe(20);
});

test('end alignment pushes the child to the far edge', () => {
  const box = new BoxNode({ width: 100, height: 60, alignX: 'end', alignY: 'end', child: new BoxNode({ width: 20, height: 20 }) });
  box.layout({ minW: 0, maxW: 200, minH: 0, maxH: 200 }, ctx);
  const child = box.children[0];
  expect(child.offsetX).toBe(80);
  expect(child.offsetY).toBe(40);
});

test('default start alignment keeps the child at padding origin', () => {
  const box = new BoxNode({ width: 100, height: 60, padding: 8, child: new BoxNode({ width: 20, height: 20 }) });
  box.layout({ minW: 0, maxW: 200, minH: 0, maxH: 200 }, ctx);
  expect(box.children[0].offsetX).toBe(8);
  expect(box.children[0].offsetY).toBe(8);
});
