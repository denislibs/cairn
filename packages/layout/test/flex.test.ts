import { test, expect } from 'vitest';
import { FlexNode, BoxNode } from '../src/index';
import { fakeMeasure } from './fake-measure';

const ctx = fakeMeasure();
// helper: a fixed-size leaf via BoxNode with explicit width/height
const box = (w: number, h: number, flex = 0) => {
  const b = new BoxNode({ width: w, height: h });
  b.flex = flex;
  return b;
};

test('row lays children left to right with gap', () => {
  const a = box(10, 20);
  const b = box(30, 40);
  const row = new FlexNode({ direction: 'row', gap: 5, children: [a, b] });
  const size = row.layout({ minW: 0, maxW: 200, minH: 0, maxH: 200 }, ctx);
  expect(a.offsetX).toBe(0);
  expect(b.offsetX).toBe(15); // 10 + gap 5
  expect(size.h).toBe(40); // max cross
});

test('column lays children top to bottom with gap', () => {
  const a = box(10, 20);
  const b = box(30, 40);
  const col = new FlexNode({ direction: 'column', gap: 5, children: [a, b] });
  col.layout({ minW: 0, maxW: 200, minH: 0, maxH: 200 }, ctx);
  expect(a.offsetY).toBe(0);
  expect(b.offsetY).toBe(25); // 20 + gap 5
});

test('flex-grow distributes remaining main-axis space proportionally', () => {
  const fixed = box(20, 10);
  const g1 = box(0, 10, 1);
  const g2 = box(0, 10, 3);
  const row = new FlexNode({ direction: 'row', children: [fixed, g1, g2] });
  row.layout({ minW: 0, maxW: 120, minH: 0, maxH: 100 }, ctx);
  // free = 120 - 20 = 100; g1 gets 25, g2 gets 75
  expect(g1.size.w).toBe(25);
  expect(g2.size.w).toBe(75);
  expect(fixed.offsetX).toBe(0);
  expect(g1.offsetX).toBe(20);
  expect(g2.offsetX).toBe(45); // 20 + 25
});

test('justify: end pushes content to the far edge', () => {
  const a = box(10, 10);
  const b = box(20, 10);
  const row = new FlexNode({ direction: 'row', justify: 'end', children: [a, b] });
  row.layout({ minW: 0, maxW: 100, minH: 0, maxH: 100 }, ctx);
  // content = 30, free = 70; start at 70
  expect(a.offsetX).toBe(70);
  expect(b.offsetX).toBe(80);
});

test('justify: center centers content', () => {
  const a = box(10, 10);
  const b = box(20, 10);
  const row = new FlexNode({ direction: 'row', justify: 'center', children: [a, b] });
  row.layout({ minW: 0, maxW: 100, minH: 0, maxH: 100 }, ctx);
  expect(a.offsetX).toBe(35); // free 70 / 2
  expect(b.offsetX).toBe(45);
});

test('justify: space-between spreads gaps evenly', () => {
  const a = box(10, 10);
  const b = box(10, 10);
  const c = box(10, 10);
  const row = new FlexNode({ direction: 'row', justify: 'space-between', children: [a, b, c] });
  row.layout({ minW: 0, maxW: 100, minH: 0, maxH: 100 }, ctx);
  // content 30, free 70, 2 gaps of 35
  expect(a.offsetX).toBe(0);
  expect(b.offsetX).toBe(45); // 10 + 35
  expect(c.offsetX).toBe(90); // 45 + 10 + 35
});

test('align: center centers children on the cross axis', () => {
  const a = box(10, 20);
  const b = box(10, 40);
  const row = new FlexNode({ direction: 'row', align: 'center', children: [a, b] });
  const size = row.layout({ minW: 0, maxW: 100, minH: 0, maxH: 100 }, ctx);
  expect(size.h).toBe(40); // tallest child
  expect(a.offsetY).toBe(10); // (40 - 20) / 2
  expect(b.offsetY).toBe(0);
});

test('align: stretch makes children fill the cross axis', () => {
  const a = box(10, 20);
  const row = new FlexNode({ direction: 'row', align: 'stretch', children: [a] });
  row.layout({ minW: 0, maxW: 100, minH: 0, maxH: 60 }, ctx);
  expect(a.size.h).toBe(60); // stretched to container cross (bounded maxH)
});

test('justify: space-around distributes symmetric spacing (exact fill)', () => {
  const a = box(10, 10);
  const b = box(10, 10);
  const c = box(10, 10);
  const row = new FlexNode({ direction: 'row', justify: 'space-around', children: [a, b, c] });
  const size = row.layout({ minW: 0, maxW: 100, minH: 0, maxH: 100 }, ctx);
  // content 30, free 70, around = 70/3; lead margin = around/2
  expect(a.offsetX).toBeCloseTo(70 / 6, 5); // ~11.667
  expect(b.offsetX).toBeCloseTo(45, 5);
  expect(c.offsetX).toBeCloseTo(100 - 70 / 6 - 10, 5); // trailing margin mirrors lead
  expect(size.w).toBe(100);
});

test('flex under unbounded main collapses to zero; container sizes to content', () => {
  const fixed = box(20, 10);
  const grow = box(0, 10, 1);
  const row = new FlexNode({ direction: 'row', children: [fixed, grow] });
  const size = row.layout({ minW: 0, maxW: Infinity, minH: 0, maxH: 100 }, ctx);
  expect(grow.size.w).toBe(0); // no bounded free space to grow into
  expect(size.w).toBe(20); // sizes to content
});

test('overflow: non-flex children exceeding the container spill (v1 silent overflow)', () => {
  const a = box(40, 10);
  const b = box(40, 10);
  const c = box(40, 10);
  const row = new FlexNode({ direction: 'row', children: [a, b, c] });
  const size = row.layout({ minW: 0, maxW: 100, minH: 0, maxH: 100 }, ctx);
  // children keep intrinsic sizes and spill past the container; no clamping in v1
  expect(a.offsetX).toBe(0);
  expect(b.offsetX).toBe(40);
  expect(c.offsetX).toBe(80); // 80 + 40 = 120 > 100 (overflow)
  expect(size.w).toBe(100); // container still reports its bounded main size
});
