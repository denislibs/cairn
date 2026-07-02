import { test, expect } from 'vitest';
import { createPath } from '../src/index';
import type {
  Renderer,
  FrameScheduler,
  SurfaceMetrics,
  Host,
  ImageHandle,
} from '../src/index';

// A trivial no-op renderer proves the interface is implementable and exported.
function makeNoopRenderer(): Renderer {
  return {
    resize() {},
    beginFrame() {},
    endFrame() {},
    clear() {},
    save() {},
    restore() {},
    translate() {},
    scale() {},
    clipRect() {},
    setShadow() {},
    fillRect() {},
    strokeRect() {},
    fillRoundRect() {},
    strokeRoundRect() {},
    fillPath() {},
    strokePath() {},
    drawText() {},
    measureText() {
      return { width: 0 };
    },
    drawImage() {},
  };
}

test('Renderer is implementable and usable', () => {
  const r = makeNoopRenderer();
  r.beginFrame();
  r.fillRect({ x: 0, y: 0, width: 1, height: 1 }, { color: '#000' });
  r.fillPath(createPath().moveTo(0, 0).build(), { color: '#000' });
  expect(r.measureText('hi', { font: '10px sans-serif' })).toEqual({ width: 0 });
});

test('FrameScheduler / SurfaceMetrics / Host are implementable', () => {
  const scheduler: FrameScheduler = {
    requestFrame() {
      return 1;
    },
    cancelFrame() {},
  };
  const metrics: SurfaceMetrics = {
    width: 100,
    height: 50,
    devicePixelRatio: 2,
    onResize() {
      return () => {};
    },
    dispose() {},
  };
  const input = { onPointer: () => () => {}, onWheel: () => () => {}, onKey: () => () => {} };
  const host: Host = { renderer: makeNoopRenderer(), scheduler, metrics, input };
  const img: ImageHandle = { width: 4, height: 4 };
  host.renderer.drawImage(img, { x: 0, y: 0, width: 4, height: 4 });

  expect(scheduler.requestFrame(() => {})).toBe(1);
  expect(host.metrics.devicePixelRatio).toBe(2);
});
