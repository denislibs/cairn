import type { FrameScheduler } from '@cairn/host';

export class WebFrameScheduler implements FrameScheduler {
  requestFrame(cb: (timeMs: number) => void): number {
    return requestAnimationFrame(cb);
  }

  cancelFrame(handle: number): void {
    cancelAnimationFrame(handle);
  }
}
