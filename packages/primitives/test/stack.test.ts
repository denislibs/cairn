import { test, expect } from 'vitest';
import { createRoot } from '@cairn/reactivity';
import { setFrameRequester } from '@cairn/runtime';
import { StackNode } from '@cairn/layout';
import { Box, Stack } from '../src/index';
import { fakeCtx } from './fake';

test('Stack positions children by their left/top', () => {
  setFrameRequester(() => {});
  const dispose = createRoot((d) => {
    const a = Box({ left: 10, top: 20, style: { width: 30, height: 30 } });
    const b = Box({ left: 50, top: 5, style: { width: 30, height: 30 } });
    const stack = Stack({ children: [a, b] });
    expect(stack.layout).toBeInstanceOf(StackNode);
    stack.layout.layout({ minW: 0, maxW: 200, minH: 0, maxH: 200 }, fakeCtx);
    expect(a.layout.offsetX).toBe(10);
    expect(a.layout.offsetY).toBe(20);
    expect(b.layout.offsetX).toBe(50);
    expect(b.layout.offsetY).toBe(5);
    return d;
  });
  dispose();
  setFrameRequester(null);
});
