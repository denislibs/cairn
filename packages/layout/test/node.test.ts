import { test, expect } from 'vitest';
import { LayoutNode, clamp, resolveAxis } from '../src/index';

class StubNode extends LayoutNode {
  layout() {
    this.size = { w: 1, h: 2 };
    return this.size;
  }
}

test('LayoutNode has default fields', () => {
  const n = new StubNode();
  expect(n.children).toEqual([]);
  expect(n.size).toEqual({ w: 0, h: 0 });
  expect(n.offsetX).toBe(0);
  expect(n.offsetY).toBe(0);
  expect(n.flex).toBe(0);
  expect(n.left).toBeUndefined();
  expect(n.top).toBeUndefined();
});

test('clamp constrains a value to a range', () => {
  expect(clamp(5, 0, 10)).toBe(5);
  expect(clamp(-1, 0, 10)).toBe(0);
  expect(clamp(11, 0, 10)).toBe(10);
});

test('resolveAxis: no props returns incoming range', () => {
  expect(resolveAxis(0, 100)).toEqual([0, 100]);
});

test('resolveAxis: exact size pins both ends (clamped to incoming)', () => {
  expect(resolveAxis(0, 100, 40)).toEqual([40, 40]);
  expect(resolveAxis(0, 30, 40)).toEqual([30, 30]); // clamped to incoming max
});

test('resolveAxis: min/max props tighten within incoming', () => {
  expect(resolveAxis(0, 100, undefined, 20, 80)).toEqual([20, 80]);
});

test('resolveAxis: only min tightens the lower bound', () => {
  expect(resolveAxis(0, 100, undefined, 50)).toEqual([50, 100]);
});

test('resolveAxis: only max tightens the upper bound', () => {
  expect(resolveAxis(0, 100, undefined, undefined, 80)).toEqual([0, 80]);
});
