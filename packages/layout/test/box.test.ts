import { test, expect } from 'vitest';
import { BoxNode, TextNode } from '../src/index';
import { fakeMeasure } from './fake-measure';

const LOOSE = { minW: 0, maxW: 1000, minH: 0, maxH: 1000 };

test('BoxNode wraps a child with uniform padding', () => {
  const child = new TextNode({ text: 'hi', style: { font: '10px sans-serif' } }); // 2*10*0.6=12 x 10
  const box = new BoxNode({ padding: 5, child });
  const size = box.layout(LOOSE, fakeMeasure());
  expect(size).toEqual({ w: 12 + 10, h: 10 + 10 }); // child + 5 each side
  expect(child.offsetX).toBe(5);
  expect(child.offsetY).toBe(5);
});

test('BoxNode per-side padding', () => {
  const child = new TextNode({ text: 'x', style: { font: '10px sans-serif' } }); // 6 x 10
  const box = new BoxNode({ padding: { top: 1, right: 2, bottom: 3, left: 4 }, child });
  const size = box.layout(LOOSE, fakeMeasure());
  expect(size).toEqual({ w: 6 + 2 + 4, h: 10 + 1 + 3 });
  expect(child.offsetX).toBe(4);
  expect(child.offsetY).toBe(1);
});

test('BoxNode explicit width/height override content size', () => {
  const child = new TextNode({ text: 'x', style: { font: '10px sans-serif' } });
  const box = new BoxNode({ width: 100, height: 50, child });
  const size = box.layout(LOOSE, fakeMeasure());
  expect(size).toEqual({ w: 100, h: 50 });
});

test('BoxNode deflates child constraints by padding', () => {
  const child = new TextNode({ text: 'wide text here', style: { font: '10px sans-serif' } });
  // parent maxW 50, padding 10 each side -> child maxW 30 -> width clamped to 30
  const box = new BoxNode({ padding: 10, child });
  box.layout({ minW: 0, maxW: 50, minH: 0, maxH: 1000 }, fakeMeasure());
  expect(child.size.w).toBe(30);
});

test('BoxNode with no child sizes to the constraint minimum', () => {
  const box = new BoxNode({});
  const size = box.layout({ minW: 7, maxW: 100, minH: 3, maxH: 100 }, fakeMeasure());
  expect(size).toEqual({ w: 7, h: 3 });
});
