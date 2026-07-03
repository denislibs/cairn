import { test, expect, vi, beforeEach, afterEach } from 'vitest';
import { createWebHost } from '../src/index';
import { createFakeContext } from './fakes';

let fakeCtx: ReturnType<typeof createFakeContext>;
let resizeCbs: Array<() => void>;

beforeEach(() => {
  fakeCtx = createFakeContext();
  resizeCbs = [];
  class FakeResizeObserver {
    constructor(cb: () => void) {
      resizeCbs.push(cb);
    }
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
    addEventListener() {},
    removeEventListener() {},
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

test('frame scheduler self-heals the backing to the live DPR before each frame', () => {
  const raf = vi.fn((cb: (t: number) => void) => { cb(0); return 1; });
  vi.stubGlobal('requestAnimationFrame', raf);
  vi.stubGlobal('cancelAnimationFrame', vi.fn());

  const canvas = fakeCanvas(300, 150);
  const host = createWebHost(canvas);
  expect(canvas.width).toBe(600); // dpr 2

  // DPR jumps (browser zoom / monitor move) with NO resize or matchMedia event.
  vi.stubGlobal('devicePixelRatio', 3);

  // The next scheduled frame syncs the backing store before running the callback.
  let painted = false;
  host.scheduler.requestFrame(() => { painted = true; });
  expect(painted).toBe(true);
  expect(canvas.width).toBe(900); // 300 * 3 — crisp at the new DPR
  expect(canvas.height).toBe(450);
});

test('backing store folds in visualViewport.scale (crisp under pinch-zoom)', () => {
  vi.stubGlobal('visualViewport', { scale: 2, addEventListener() {}, removeEventListener() {} });
  const raf = vi.fn((cb: (t: number) => void) => { cb(0); return 1; });
  vi.stubGlobal('requestAnimationFrame', raf);
  vi.stubGlobal('cancelAnimationFrame', vi.fn());

  const canvas = fakeCanvas(300, 150);
  createWebHost(canvas);
  // dpr(2) * pinch scale(2) = 4×
  expect(canvas.width).toBe(1200);
  expect(canvas.height).toBe(600);
});

test('backing store is capped at the max texture dimension', () => {
  // dpr 2 * scale 3 = 6× → 5000*6 = 30000 would exceed 8192; must clamp.
  vi.stubGlobal('visualViewport', { scale: 3, addEventListener() {}, removeEventListener() {} });
  const canvas = fakeCanvas(5000, 100);
  createWebHost(canvas);
  expect(canvas.width).toBeLessThanOrEqual(8192);
});

test('renderer.resize is idempotent — an unchanged size does not rewrite the backing store', () => {
  const canvas = fakeCanvas(300, 150);
  let widthWrites = 0;
  let backing = 600;
  Object.defineProperty(canvas, 'width', {
    get: () => backing,
    set: (v: number) => { widthWrites++; backing = v; },
  });

  const host = createWebHost(canvas); // one write (initial sizing)
  const afterInit = widthWrites;
  expect(afterInit).toBeGreaterThan(0);

  // Same logical size + dpr → backing must NOT be rewritten (rewriting clears the canvas).
  host.renderer.resize(300, 150, 2);
  expect(widthWrites).toBe(afterInit);
});

test('createWebHost keeps the backing store in sync on resize', () => {
  const canvas = fakeCanvas(300, 150);
  createWebHost(canvas);
  expect(canvas.width).toBe(600);

  // simulate a surface resize
  (canvas as unknown as { clientWidth: number }).clientWidth = 400;
  (canvas as unknown as { clientHeight: number }).clientHeight = 200;
  resizeCbs.forEach((fn) => fn());

  expect(canvas.width).toBe(800); // 400 * dpr(2)
  expect(canvas.height).toBe(400); // 200 * dpr(2)
});
