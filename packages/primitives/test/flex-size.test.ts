import { test, expect } from 'vitest';
import { createRoot } from '@cairn/reactivity';
import { setFrameRequester } from '@cairn/runtime';
import { Box, Row, Column } from '../src/index';
import { fakeCtx } from './fake';

test('Column sizes from style width/height', () => {
  setFrameRequester(() => {});
  const dispose = createRoot((d) => {
    const col = Column({ style: { width: 300, height: 200 } });
    col.layout.layout({ minW: 0, maxW: 1000, minH: 0, maxH: 1000 }, fakeCtx);
    expect(col.layout.size).toEqual({ w: 300, h: 200 });
    return d;
  });
  dispose();
  setFrameRequester(null);
});

test('flex children split the main axis in a sized Row', () => {
  setFrameRequester(() => {});
  const dispose = createRoot((d) => {
    const a = Box({ flex: 1, style: { height: 10 } });
    const b = Box({ flex: 1, style: { height: 10 } });
    const row = Row({ style: { width: 300 }, children: [a, b] });
    row.layout.layout({ minW: 0, maxW: 1000, minH: 0, maxH: 1000 }, fakeCtx);
    expect(a.layout.size.w).toBe(150);
    expect(b.layout.size.w).toBe(150);
    return d;
  });
  dispose();
  setFrameRequester(null);
});
