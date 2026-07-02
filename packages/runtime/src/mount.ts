import { createRoot } from '@cairn/reactivity';
import type { Host } from '@cairn/host';
import type { LayoutContext } from '@cairn/layout';
import { type Instance, paint } from './instance';
import { setFrameRequester } from './scheduler';

// Mount a component tree into a Host. Full-frame model: any change schedules one
// coalesced frame that re-lays-out from the root and repaints the whole surface.
export function mount(component: () => Instance, host: Host): () => void {
  return createRoot((dispose) => {
    const ctx: LayoutContext = {
      measureText: (t, s) => host.renderer.measureText(t, s),
    };
    let root: Instance;

    const renderFrame = (): void => {
      const w = host.metrics.width;
      const h = host.metrics.height;
      root.layout.layout({ minW: w, maxW: w, minH: h, maxH: h }, ctx); // tight = surface
      host.renderer.beginFrame();
      host.renderer.clear();
      paint(root, host.renderer);
      host.renderer.endFrame();
    };

    // Build the tree first. Effects run now; scheduleFrame() no-ops because the
    // requester is not installed yet (avoids a redundant initial frame).
    root = component();
    renderFrame(); // initial paint

    let frameScheduled = false;
    setFrameRequester(() => {
      if (frameScheduled) return;
      frameScheduled = true;
      host.scheduler.requestFrame(() => {
        frameScheduled = false;
        renderFrame();
      });
    });

    host.metrics.onResize(() => renderFrame());

    return () => {
      setFrameRequester(null);
      dispose();
    };
  });
}
