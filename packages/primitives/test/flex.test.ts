import { test, expect } from 'vitest';
import { FlexNode } from '@cairn/layout';
import { Box, Row, Column } from '../src/index';
import { fakeCtx } from './fake';

test('Row builds a row FlexNode and positions children left to right', () => {
  const a = Box({ style: { width: 10, height: 10 } });
  const b = Box({ style: { width: 20, height: 10 } });
  const row = Row({ style: { gap: 5 }, children: [a, b] });
  expect((row.layout as FlexNode).direction).toBe('row');
  expect(row.children).toEqual([a, b]);

  row.layout.layout({ minW: 0, maxW: 100, minH: 0, maxH: 100 }, fakeCtx);
  expect(a.layout.offsetX).toBe(0);
  expect(b.layout.offsetX).toBe(15); // 10 + gap 5
});

test('Column builds a column FlexNode stacking top to bottom', () => {
  const a = Box({ style: { width: 10, height: 20 } });
  const b = Box({ style: { width: 10, height: 30 } });
  const col = Column({ style: { gap: 4 }, children: [a, b] });
  expect((col.layout as FlexNode).direction).toBe('column');
  col.layout.layout({ minW: 0, maxW: 100, minH: 0, maxH: 100 }, fakeCtx);
  expect(a.layout.offsetY).toBe(0);
  expect(b.layout.offsetY).toBe(24); // 20 + gap 4
});

test('Row accepts a single (non-array) child', () => {
  const only = Box({ style: { width: 10, height: 10 } });
  const row = Row({ children: only });
  expect(row.children).toEqual([only]);
  expect((row.layout as FlexNode).children[0]).toBe(only.layout);
});

test('Row containers paint nothing themselves', () => {
  const row = Row({ children: [] });
  const calls: unknown[][] = [];
  row.paintSelf({ fillRect: () => calls.push(['fillRect']) } as never);
  expect(calls).toEqual([]);
});

test('Column forwards mainAxisSize to the FlexNode (default max)', () => {
  expect((Column({}).layout as FlexNode).mainAxisSize).toBe('max');
  expect((Column({ mainAxisSize: 'min' }).layout as FlexNode).mainAxisSize).toBe('min');
});
