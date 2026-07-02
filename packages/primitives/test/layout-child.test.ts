import { test, expect } from 'vitest';
import { createRoot } from '@cairn/reactivity';
import { setFrameRequester } from '@cairn/runtime';
import { Box, Row } from '../src/index';

test('flex/left/top props set the instance layout parent-data', () => {
  setFrameRequester(() => {});
  const dispose = createRoot((d) => {
    const b = Box({ flex: 2, left: 10, top: 20 });
    expect(b.layout.flex).toBe(2);
    expect(b.layout.left).toBe(10);
    expect(b.layout.top).toBe(20);
    const r = Row({});
    expect(r.layout.flex).toBe(0);
    return d;
  });
  dispose();
  setFrameRequester(null);
});
