import { test, expect, vi, beforeEach, afterEach } from 'vitest';
import { createWebHost } from '../src/index';
import { createFakeContext } from './fakes';

let fakeCtx: ReturnType<typeof createFakeContext>;

beforeEach(() => {
  fakeCtx = createFakeContext();
  class FakeResizeObserver {
    observe() {}
    disconnect() {}
  }
  vi.stubGlobal('ResizeObserver', FakeResizeObserver as unknown as typeof ResizeObserver);
  vi.stubGlobal('devicePixelRatio', 2);
  vi.stubGlobal('matchMedia', vi.fn(() => ({ addEventListener() {}, removeEventListener() {} })));
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function fakeCanvas(w: number, h: number) {
  return {
    clientWidth: w,
    clientHeight: h,
    width: 0,
    height: 0,
    getContext: () => fakeCtx,
  } as unknown as HTMLCanvasElement;
}

test('createWebHost returns a Host with renderer, scheduler, and metrics', () => {
  const host = createWebHost(fakeCanvas(300, 150));
  expect(typeof host.renderer.fillRect).toBe('function');
  expect(typeof host.scheduler.requestFrame).toBe('function');
  expect(host.metrics.width).toBe(300);
  expect(host.metrics.height).toBe(150);
  expect(host.metrics.devicePixelRatio).toBe(2);
});

test('createWebHost configures the renderer backing store from metrics (DPR applied)', () => {
  const canvas = fakeCanvas(300, 150);
  createWebHost(canvas);
  // backing store = logical * dpr
  expect(canvas.width).toBe(600);
  expect(canvas.height).toBe(300);
  expect(fakeCtx.calls).toContainEqual(['setTransform', 2, 0, 0, 2, 0, 0]);
});
