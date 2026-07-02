import { test, expect } from 'vitest';
import { TextNode } from '../src/index';
import { fakeMeasure } from './fake-measure';

const LOOSE = { minW: 0, maxW: 1000, minH: 0, maxH: 1000 };

test('TextNode measures width from context and height from font size', () => {
  const t = new TextNode({ text: 'hello', style: { font: '20px sans-serif' } });
  const size = t.layout(LOOSE, fakeMeasure());
  expect(size).toEqual({ w: 5 * 20 * 0.6, h: 20 }); // 60 x 20
  expect(t.size).toEqual({ w: 60, h: 20 });
});

test('TextNode clamps width to the max constraint', () => {
  const t = new TextNode({ text: 'hello', style: { font: '20px sans-serif' } });
  const size = t.layout({ minW: 0, maxW: 40, minH: 0, maxH: 1000 }, fakeMeasure());
  expect(size.w).toBe(40); // measured 60, clamped to 40
  expect(size.h).toBe(20);
});

test('TextNode explicit lineHeight overrides font-derived height', () => {
  const t = new TextNode({ text: 'hi', style: { font: '16px sans-serif' }, lineHeight: 24 });
  const size = t.layout(LOOSE, fakeMeasure());
  expect(size.h).toBe(24);
});

test('TextNode defaults font size to 16 when the font has no px value', () => {
  const t = new TextNode({ text: 'hi', style: { font: 'bold sans-serif' } });
  const size = t.layout(LOOSE, fakeMeasure());
  expect(size.h).toBe(16);
});
