import { test, expect, vi, beforeEach, afterEach } from 'vitest';
import { WebSurfaceMetrics } from '../src/index';

// Minimal fake element with controllable client size.
function makeEl(w: number, h: number) {
  return { clientWidth: w, clientHeight: h } as unknown as HTMLElement;
}

let resizeCbs: Array<() => void>;
let observed: unknown[];

beforeEach(() => {
  resizeCbs = [];
  observed = [];
  class FakeResizeObserver {
    constructor(cb: () => void) {
      resizeCbs.push(cb);
    }
    observe(el: unknown) {
      observed.push(el);
    }
    disconnect() {}
  }
  vi.stubGlobal('ResizeObserver', FakeResizeObserver as unknown as typeof ResizeObserver);
  vi.stubGlobal('devicePixelRatio', 2);
  // matchMedia is used for DPR-change detection; make it a no-op fake.
  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => ({ addEventListener() {}, removeEventListener() {} })),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

test('reports the element logical size and devicePixelRatio', () => {
  const metrics = new WebSurfaceMetrics(makeEl(300, 150));
  expect(metrics.width).toBe(300);
  expect(metrics.height).toBe(150);
  expect(metrics.devicePixelRatio).toBe(2);
});

test('observes the element for resize', () => {
  const el = makeEl(300, 150);
  new WebSurfaceMetrics(el);
  expect(observed).toContain(el);
});

test('notifies subscribers on resize with updated size', () => {
  const el = makeEl(300, 150);
  const metrics = new WebSurfaceMetrics(el);
  const cb = vi.fn();
  metrics.onResize(cb);

  // simulate a resize
  (el as unknown as { clientWidth: number }).clientWidth = 400;
  (el as unknown as { clientHeight: number }).clientHeight = 200;
  resizeCbs.forEach((fn) => fn());

  expect(cb).toHaveBeenCalledTimes(1);
  expect(metrics.width).toBe(400);
  expect(metrics.height).toBe(200);
  expect(cb.mock.calls[0][0].width).toBe(400);
});

test('unsubscribe stops notifications', () => {
  const el = makeEl(300, 150);
  const metrics = new WebSurfaceMetrics(el);
  const cb = vi.fn();
  const off = metrics.onResize(cb);
  off();
  // Change the size so update() would notify if the sub were still active —
  // this isolates the unsubscribe behavior from the no-change early-exit.
  (el as unknown as { clientWidth: number }).clientWidth = 500;
  resizeCbs.forEach((fn) => fn());
  expect(cb).not.toHaveBeenCalled();
});

test('dispose disconnects the observer and stops notifications', () => {
  const el = makeEl(300, 150);
  const metrics = new WebSurfaceMetrics(el);
  const cb = vi.fn();
  metrics.onResize(cb);
  metrics.dispose();
  (el as unknown as { clientWidth: number }).clientWidth = 600;
  resizeCbs.forEach((fn) => fn());
  expect(cb).not.toHaveBeenCalled();
});
