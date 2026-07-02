import { test, expect } from 'vitest';
import { BoxNode, FlexNode, TextNode } from '../src/index';
import { fakeMeasure } from './fake-measure';

const ctx = fakeMeasure();

test('nested tree: Box(padding) > Row(gap) > two fixed boxes', () => {
  const a = new BoxNode({ width: 10, height: 20 });
  const b = new BoxNode({ width: 30, height: 40 });
  const row = new FlexNode({ direction: 'row', gap: 5, children: [a, b] });
  const outer = new BoxNode({ padding: 8, child: row });

  const size = outer.layout({ minW: 0, maxW: 500, minH: 0, maxH: 500 }, ctx);

  // A Flex fills its bounded main axis (like Flutter Row's default mainAxisSize.max):
  // available width = 500 - 16 padding = 484. Cross (height) wraps the tallest child.
  expect(row.size.w).toBe(484);
  expect(row.size.h).toBe(40);
  // Outer box fills width (child + padding, clamped to maxW) and wraps height.
  expect(size).toEqual({ w: 500, h: 40 + 16 });
  // Row is offset by the padding; children offsets are relative to the row.
  expect(row.offsetX).toBe(8);
  expect(row.offsetY).toBe(8);
  expect(a.offsetX).toBe(0);
  expect(b.offsetX).toBe(15); // 10 + gap 5
});

test('nested tree: Column of Text rows wraps to content height', () => {
  const t1 = new TextNode({ text: 'hello', style: { font: '10px sans-serif' } }); // 30 x 10
  const t2 = new TextNode({ text: 'world!', style: { font: '10px sans-serif' } }); // 36 x 10
  const col = new FlexNode({ direction: 'column', gap: 4, children: [t1, t2] });

  const size = col.layout({ minW: 0, maxW: 200, minH: 0, maxH: Infinity }, ctx);

  // Unbounded main (height) -> column wraps content: 10 + 4 + 10 = 24.
  expect(size.h).toBe(24);
  expect(t1.offsetY).toBe(0);
  expect(t2.offsetY).toBe(14); // 10 + gap 4
});
