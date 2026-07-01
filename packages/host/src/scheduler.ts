export interface FrameScheduler {
  requestFrame(cb: (timeMs: number) => void): number;
  cancelFrame(handle: number): void;
}
