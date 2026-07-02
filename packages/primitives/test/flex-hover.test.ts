import { test, expect } from 'vitest';
import { createRoot } from '@cairn/reactivity';
import { setFrameRequester } from '@cairn/runtime';
import type { CairnPointerEvent } from '@cairn/events';
import { FlexNode } from '@cairn/layout';
import { Row, Text } from '../src/index';
import { createFakeRenderer, fakeCtx, LOOSE } from './fake';

const ev = {} as CairnPointerEvent;

test('Row hover changes gap on the FlexNode', () => {
  setFrameRequester(() => {});
  let row!: ReturnType<typeof Row>;
  const dispose = createRoot((d) => {
    row = Row({ style: { gap: 4, hover: { gap: 16 } } });
    return d;
  });
  expect((row.layout as FlexNode).gap).toBe(4);
  row.handlers!.onPointerEnter!(ev);
  expect((row.layout as FlexNode).gap).toBe(16);
  dispose();
  setFrameRequester(null);
});

test('Text hover changes the painted color', () => {
  setFrameRequester(() => {});
  let t!: ReturnType<typeof Text>;
  const dispose = createRoot((d) => {
    t = Text({ children: 'hi', style: { color: '#111', hover: { color: '#f00' } } });
    return d;
  });
  t.layout.layout(LOOSE, fakeCtx);

  let r = createFakeRenderer();
  t.paintSelf(r);
  let call = r.calls.find((c) => c[0] === 'drawText')!;
  expect((call[3] as { color: string }).color).toBe('#111');

  t.handlers!.onPointerEnter!(ev);
  r = createFakeRenderer();
  t.paintSelf(r);
  call = r.calls.find((c) => c[0] === 'drawText')!;
  expect((call[3] as { color: string }).color).toBe('#f00');

  dispose();
  setFrameRequester(null);
});
