// Module-scoped frame requester. Phase 4 supports a single active root; mount installs
// a coalescing requester over the Host scheduler. scheduleFrame() forwards to it.
let requester: (() => void) | null = null;

export function setFrameRequester(fn: (() => void) | null): void {
  if (fn !== null && requester !== null) {
    throw new Error(
      '[cairn] A frame requester is already installed (Phase 4 supports a single active root). Dispose the previous mount first.',
    );
  }
  requester = fn;
}

export function scheduleFrame(): void {
  if (requester) requester();
}
