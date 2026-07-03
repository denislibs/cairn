import { createRoot, runWithContext } from '@cairn/reactivity';
import { createPointerDispatcher, createFocusManager } from '@cairn/events';
import type { Host } from '@cairn/host';
import type { LayoutContext } from '@cairn/layout';
import { type Instance, paint } from './instance';
import { setFrameRequester } from './scheduler';
import { hostContext } from './host-context';

// Returns the topmost cursor in a target-first path, falling back to 'default'.
export function cursorOf(path: { cursor?: string }[]): string {
  for (const node of path) if (node.cursor) return node.cursor;
  return 'default';
}

// Mount a component tree into a Host. Full-frame model: any change schedules one
// coalesced frame that re-lays-out from the root and repaints the whole surface.
export function mount(component: () => Instance, host: Host): () => void {
  return createRoot((dispose) => {
    const ctx: LayoutContext = {
      measureText: (t, s) => host.renderer.measureText(t, s),
      viewport: { w: 0, h: 0 },
      rootFontSize: 16,
    };
    let root: Instance;

    const renderFrame = (): void => {
      const w = host.metrics.width;
      const h = host.metrics.height;
      ctx.viewport = { w, h };
      root.layout.layout({ minW: w, maxW: w, minH: h, maxH: h }, ctx); // tight = surface
      host.renderer.beginFrame();
      host.renderer.clear();
      paint(root, host.renderer);
      host.renderer.endFrame();
    };

    // Build the tree first. Effects run now; scheduleFrame() no-ops because the
    // requester is not installed yet (avoids a redundant initial frame).
    root = runWithContext(hostContext, host, () => component());
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

    const unsubscribeResize = host.metrics.onResize(() => renderFrame());

    const focus = createFocusManager(() => root);
    const dispatcher = createPointerDispatcher(() => root, {
      onPointerDown: (path) => focus.focusFromPointer(path),
      onHoverChange: (path) => host.setCursor?.(cursorOf(path)),
    });
    const unsubscribePointer = host.input.onPointer((e) => dispatcher.handlePointer(e));
    const unsubscribeWheel = host.input.onWheel((e) => dispatcher.handleWheel(e));
    const unsubscribeKey = host.input.onKey((e) => focus.handleKey(e));

    return () => {
      unsubscribePointer();
      unsubscribeWheel();
      unsubscribeKey();
      unsubscribeResize(); // avoid re-render on a disposed tree
      setFrameRequester(null);
      dispose();
    };
  });
}
