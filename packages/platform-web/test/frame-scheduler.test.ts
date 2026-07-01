import { test, expect, vi, beforeEach, afterEach } from 'vitest';
import { WebFrameScheduler } from '../src/index';

let raf: ReturnType<typeof vi.fn>;
let caf: ReturnType<typeof vi.fn>;

beforeEach(() => {
  raf = vi.fn((cb: FrameRequestCallback) => {
    return 42;
  });
  caf = vi.fn();
  vi.stubGlobal('requestAnimationFrame', raf);
  vi.stubGlobal('cancelAnimationFrame', caf);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

test('requestFrame delegates to requestAnimationFrame and returns the handle', () => {
  const scheduler = new WebFrameScheduler();
  const cb = vi.fn();
  const handle = scheduler.requestFrame(cb);
  expect(raf).toHaveBeenCalledTimes(1);
  expect(handle).toBe(42);
  // the callback passed to rAF should invoke our callback with the time
  const rafCb = raf.mock.calls[0][0] as FrameRequestCallback;
  rafCb(123.5);
  expect(cb).toHaveBeenCalledWith(123.5);
});

test('cancelFrame delegates to cancelAnimationFrame', () => {
  const scheduler = new WebFrameScheduler();
  scheduler.cancelFrame(7);
  expect(caf).toHaveBeenCalledWith(7);
});
