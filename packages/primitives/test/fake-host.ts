import type { FrameScheduler, SurfaceMetrics, Host } from '@cairn/host';
import { createFakeRenderer } from './fake';

export function createFakeHost() {
  const renderer = createFakeRenderer();
  const pending: Array<() => void> = [];
  const scheduler: FrameScheduler = {
    requestFrame(cb) {
      pending.push(() => cb(0));
      return pending.length;
    },
    cancelFrame() {},
  };
  const metrics: SurfaceMetrics = {
    width: 200,
    height: 100,
    devicePixelRatio: 1,
    onResize: () => () => {},
    dispose: () => {},
  };
  const input = { onPointer: () => () => {}, onWheel: () => () => {}, onKey: () => () => {} };
  const host: Host = { renderer, scheduler, metrics, input };
  return {
    host,
    renderer,
    flush() {
      const q = pending.splice(0);
      for (const f of q) f();
    },
  };
}
