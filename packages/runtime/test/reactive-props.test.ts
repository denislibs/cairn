import { test, expect, vi } from 'vitest';
import { createRoot, createSignal } from '@cairn/reactivity';
import { bind, setFrameRequester } from '../src/index';

test('bind applies a static value once', () => {
  const apply = vi.fn();
  createRoot(() => {
    bind(42, apply);
  });
  expect(apply).toHaveBeenCalledTimes(1);
  expect(apply).toHaveBeenCalledWith(42);
});

test('bind re-applies a reactive value and schedules a frame on change', () => {
  const req = vi.fn();
  setFrameRequester(req);
  const [n, setN] = createSignal(1);
  const apply = vi.fn();
  const dispose = createRoot((d) => {
    bind(() => n(), apply);
    return d;
  });
  expect(apply).toHaveBeenNthCalledWith(1, 1);
  expect(req).toHaveBeenCalledTimes(1); // initial effect run schedules
  setN(2);
  expect(apply).toHaveBeenNthCalledWith(2, 2);
  expect(req).toHaveBeenCalledTimes(2);
  dispose();
  setFrameRequester(null);
});

test('scheduleFrame is a no-op when no requester is installed', () => {
  setFrameRequester(null);
  const apply = vi.fn();
  const dispose = createRoot((d) => {
    bind(() => 7, apply);
    return d;
  });
  expect(apply).toHaveBeenCalledWith(7);
  dispose();
});
