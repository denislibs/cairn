import { test, expect } from 'vitest';
import { createRoot } from '@cairn/reactivity';
import { setFrameRequester } from '@cairn/runtime';
import type { CairnFocusEvent, CairnKeyboardEvent } from '@cairn/events';
import { Box, createInteractive } from '../src/index';

const fe = {} as CairnFocusEvent;
const ke = {} as CairnKeyboardEvent;

test('createInteractive: onFocus activates the focus variant; blur reverts', () => {
  const { resolved, handlers } = createInteractive({
    style: { backgroundColor: '#fff', focus: { backgroundColor: '#00f' } },
  });
  handlers.onFocus!(fe);
  expect(resolved().backgroundColor).toBe('#00f');
  handlers.onBlur!(fe);
  expect(resolved().backgroundColor).toBe('#fff');
});

test('createInteractive passes onKeyDown through to the user handler', () => {
  const log: string[] = [];
  const { handlers } = createInteractive({ style: {}, onKeyDown: () => log.push('key') });
  handlers.onKeyDown!(ke);
  expect(log).toEqual(['key']);
});

test('Box focusable prop sets Instance.focusable', () => {
  setFrameRequester(() => {});
  let box!: ReturnType<typeof Box>;
  const dispose = createRoot((d) => {
    box = Box({ focusable: true });
    return d;
  });
  expect(box.focusable).toBe(true);
  dispose();
  setFrameRequester(null);
});

test('Box without focusable leaves it undefined', () => {
  setFrameRequester(() => {});
  let box!: ReturnType<typeof Box>;
  const dispose = createRoot((d) => {
    box = Box({});
    return d;
  });
  expect(box.focusable).toBeUndefined();
  dispose();
  setFrameRequester(null);
});
