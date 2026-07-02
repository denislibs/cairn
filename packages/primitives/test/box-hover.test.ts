import { test, expect } from 'vitest';
import { createRoot } from '@cairn/reactivity';
import { setFrameRequester } from '@cairn/runtime';
import type { CairnPointerEvent } from '@cairn/events';
import { BoxNode } from '@cairn/layout';
import { Box } from '../src/index';
import { createFakeRenderer, fakeCtx, LOOSE } from './fake';

const ev = {} as CairnPointerEvent;
const bgOf = (r: { calls: unknown[][] }) => {
  const call = r.calls.find((c) => c[0] === 'fillRoundRect');
  return call ? (call[3] as { color: string }).color : undefined;
};

test('hover swaps the resolved paint style and reverts on leave', () => {
  setFrameRequester(() => {});
  let box!: ReturnType<typeof Box>;
  const dispose = createRoot((d) => {
    box = Box({ style: { backgroundColor: '#fff', hover: { backgroundColor: '#eee' } } });
    return d;
  });

  box.layout.layout(LOOSE, fakeCtx);
  let r = createFakeRenderer();
  box.paintSelf(r);
  expect(bgOf(r)).toBe('#fff');

  box.handlers!.onPointerEnter!(ev);
  r = createFakeRenderer();
  box.paintSelf(r);
  expect(bgOf(r)).toBe('#eee');

  box.handlers!.onPointerLeave!(ev);
  r = createFakeRenderer();
  box.paintSelf(r);
  expect(bgOf(r)).toBe('#fff');

  dispose();
  setFrameRequester(null);
});

test('hover can change layout (padding) and trigger a size change', () => {
  setFrameRequester(() => {});
  let box!: ReturnType<typeof Box>;
  const dispose = createRoot((d) => {
    box = Box({ style: { width: 20, height: 20, hover: { width: 40 } } });
    return d;
  });

  box.layout.layout(LOOSE, fakeCtx);
  expect((box.layout as BoxNode).size.w).toBe(20);

  box.handlers!.onPointerEnter!(ev);
  box.layout.layout(LOOSE, fakeCtx);
  expect((box.layout as BoxNode).size.w).toBe(40);

  dispose();
  setFrameRequester(null);
});
