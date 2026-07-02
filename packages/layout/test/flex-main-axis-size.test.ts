import { test, expect } from 'vitest';
import { FlexNode, BoxNode } from '../src/index';
import type { LayoutContext } from '../src/index';

const ctx: LayoutContext = { measureText: (t) => ({ width: t.length * 7 }) };
const child = (w: number, h: number) => new BoxNode({ width: w, height: h });

test("default 'max' fills the main axis", () => {
  const col = new FlexNode({ direction: 'column', children: [child(20, 30)] });
  col.layout({ minW: 0, maxW: 100, minH: 0, maxH: 200 }, ctx);
  expect(col.size.h).toBe(200);
});

test("'min' shrink-wraps the main axis to content", () => {
  const col = new FlexNode({ direction: 'column', mainAxisSize: 'min', gap: 10, children: [child(20, 30), child(20, 40)] });
  col.layout({ minW: 0, maxW: 100, minH: 0, maxH: 200 }, ctx);
  expect(col.size.h).toBe(80);
});

test("'min' still respects minH", () => {
  const col = new FlexNode({ direction: 'column', mainAxisSize: 'min', children: [child(20, 30)] });
  col.layout({ minW: 0, maxW: 100, minH: 50, maxH: 200 }, ctx);
  expect(col.size.h).toBe(50);
});
