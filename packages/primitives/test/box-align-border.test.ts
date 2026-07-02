import { test, expect } from 'vitest';
import { createRoot } from '@cairn/reactivity';
import { setFrameRequester } from '@cairn/runtime';
import { BoxNode } from '@cairn/layout';
import { Box } from '../src/index';
import { createFakeRenderer, fakeCtx, LOOSE } from './fake';

test('Box forwards alignX/alignY to the BoxNode', () => {
  setFrameRequester(() => {});
  const dispose = createRoot((d) => {
    const b = Box({ style: { width: 100, height: 50, alignX: 'center', alignY: 'end' } });
    expect((b.layout as BoxNode).alignX).toBe('center');
    expect((b.layout as BoxNode).alignY).toBe('end');
    return d;
  });
  dispose();
  setFrameRequester(null);
});

test('Box paints a border stroke when style.border is set', () => {
  setFrameRequester(() => {});
  let b!: ReturnType<typeof Box>;
  const dispose = createRoot((d) => {
    b = Box({ style: { width: 40, height: 30, borderRadius: 8, border: { width: 2, color: '#f00' } } });
    return d;
  });
  b.layout.layout(LOOSE, fakeCtx);
  const r = createFakeRenderer();
  b.paintSelf(r);
  const stroke = r.calls.find((c) => c[0] === 'strokeRoundRect');
  expect(stroke).toBeTruthy();
  expect(stroke![3] as { color: string; width: number }).toEqual({ color: '#f00', width: 2 });
  dispose();
  setFrameRequester(null);
});
