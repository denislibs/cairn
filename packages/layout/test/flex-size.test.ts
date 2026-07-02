import { test, expect } from 'vitest';
import { FlexNode, BoxNode } from '../src/index';
import type { LayoutContext } from '../src/index';

const ctx: LayoutContext = { measureText: (t) => ({ width: t.length * 7 }) };

test('explicit width/height override the computed size', () => {
  const col = new FlexNode({ direction: 'column', width: 120, height: 90, children: [new BoxNode({ width: 20, height: 20 })] });
  col.layout({ minW: 0, maxW: 500, minH: 0, maxH: 500 }, ctx);
  expect(col.size).toEqual({ w: 120, h: 90 });
});

test('explicit height overrides even mainAxisSize:min', () => {
  const col = new FlexNode({ direction: 'column', mainAxisSize: 'min', height: 200, children: [new BoxNode({ width: 20, height: 20 })] });
  col.layout({ minW: 0, maxW: 500, minH: 0, maxH: 500 }, ctx);
  expect(col.size.h).toBe(200);
});

test('flex children split the explicit main size, not the constraint', () => {
  const a = new BoxNode({ height: 10 });
  const b = new BoxNode({ height: 10 });
  a.flex = 1;
  b.flex = 1;
  const row = new FlexNode({ direction: 'row', width: 300, children: [a, b] });
  row.layout({ minW: 0, maxW: 1000, minH: 0, maxH: 1000 }, ctx);
  expect(a.size.w).toBe(150);
  expect(b.size.w).toBe(150);
});
