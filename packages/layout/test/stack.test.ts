import { test, expect } from 'vitest';
import { StackNode, BoxNode } from '../src/index';
import { fakeMeasure } from './fake-measure';

const ctx = fakeMeasure();

test('StackNode positions children by their left/top', () => {
  const a = new BoxNode({ width: 10, height: 10 });
  a.left = 5;
  a.top = 8;
  const b = new BoxNode({ width: 10, height: 10 });
  // no left/top -> defaults to 0,0
  const stack = new StackNode({ children: [a, b] });
  stack.layout({ minW: 0, maxW: 100, minH: 0, maxH: 100 }, ctx);
  expect(a.offsetX).toBe(5);
  expect(a.offsetY).toBe(8);
  expect(b.offsetX).toBe(0);
  expect(b.offsetY).toBe(0);
});

test('StackNode fills bounded constraints', () => {
  const stack = new StackNode({ children: [] });
  const size = stack.layout({ minW: 0, maxW: 100, minH: 0, maxH: 50 }, ctx);
  expect(size).toEqual({ w: 100, h: 50 });
});

test('StackNode sizes to the child bounding box when unbounded', () => {
  const a = new BoxNode({ width: 10, height: 10 });
  a.left = 5;
  a.top = 8;
  const stack = new StackNode({ children: [a] });
  const size = stack.layout({ minW: 0, maxW: Infinity, minH: 0, maxH: Infinity }, ctx);
  expect(size).toEqual({ w: 15, h: 18 }); // left+w, top+h
});

test('StackNode floors its size at the constraint minimum', () => {
  const stack = new StackNode({ children: [] });
  const size = stack.layout({ minW: 20, maxW: Infinity, minH: 15, maxH: Infinity }, ctx);
  expect(size).toEqual({ w: 20, h: 15 }); // empty bbox (0) floored to min
});

test('StackNode hugs normal children when an overlay child is present', () => {
  const content = new BoxNode({ width: 40, height: 24 });
  const overlay = new BoxNode({ width: '100%' as any, height: '100%' as any });
  overlay.overlay = true;
  const stack = new StackNode({ children: [content, overlay] });
  // Bounded max (as inside a Row) would normally fill to 200 — overlay makes it hug.
  const size = stack.layout({ minW: 0, maxW: 200, minH: 0, maxH: 200 }, ctx);
  expect(size).toEqual({ w: 40, h: 24 });
  // The overlay is laid out tight to the hugged size.
  expect(overlay.size).toEqual({ w: 40, h: 24 });
});

test('StackNode without overlay still fills bounded constraints (unchanged)', () => {
  const content = new BoxNode({ width: 40, height: 24 });
  const stack = new StackNode({ children: [content] });
  const size = stack.layout({ minW: 0, maxW: 200, minH: 0, maxH: 80 }, ctx);
  expect(size).toEqual({ w: 200, h: 80 });
});
