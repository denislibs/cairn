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
