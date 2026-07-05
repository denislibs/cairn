import { createRoot, runWithContext } from '@cairn/reactivity';
import { createPointerDispatcher, createFocusManager } from '@cairn/events';
import type { Host } from '@cairn/host';
import type { LayoutContext } from '@cairn/layout';
import { type Instance, paint } from './instance';
import { setFrameRequester, flushAfterLayout, scheduleFrame } from './scheduler';
import { emitCommit } from './devtools-hook';
import { hostContext } from './host-context';
import { createOverlayRegistry, overlayContext } from './overlays';
import { collectSemantics } from './semantics';

const now = (): number => (typeof performance !== 'undefined' && performance.now ? performance.now() : 0);

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
    const overlays = createOverlayRegistry();

    const layered = (): Instance => ({
      layout: {
        offsetX: 0,
        offsetY: 0,
        size: { w: host.metrics.width, h: host.metrics.height },
      } as any,
      children: [root, ...overlays.list()],
      handlers: {},
      paintSelf() {},
    });

    const renderFrame = (): void => {
      const t0 = now();
      const w = host.metrics.width;
      const h = host.metrics.height;
      ctx.viewport = { w, h };
      root.layout.layout({ minW: w, maxW: w, minH: h, maxH: h }, ctx); // tight = surface
      const list = overlays.list();
      for (const o of list) o.layout.layout({ minW: 0, maxW: w, minH: 0, maxH: h }, ctx);
      flushAfterLayout();
      const tLayout = now();
      if (host.a11y) {
        // Collect from the app root AND every overlay (Portal content — Select
        // listboxes, Menus, Dialogs — lives in the overlay layer, not under root).
        const nodes = collectSemantics(root);
        for (const o of list) nodes.push(...collectSemantics(o));
        host.a11y.sync(nodes);
      }
      const tA11y = now();
      host.renderer.beginFrame();
      host.renderer.clear();
      paint(root, host.renderer);
      for (const o of list) paint(o, host.renderer);
      host.renderer.endFrame();
      const tPaint = now();
      emitCommit(root, ctx.viewport, {
        total: tPaint - t0,
        layout: tLayout - t0,
        a11y: tA11y - tLayout,
        paint: tPaint - tA11y,
      });
    };

    // Build the tree first. Effects run now; scheduleFrame() no-ops because the
    // requester is not installed yet (avoids a redundant initial frame).
    root = runWithContext(hostContext, host, () =>
      runWithContext(overlayContext, overlays, () => component()),
    );
    overlays.setAppRoot(root);
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

    // Coalesce surface changes (resize / DPR / settled pinch) into one scheduled
    // frame instead of a synchronous re-layout+repaint per event — avoids jank
    // during rapid changes. The host syncs the backing store before the frame.
    const unsubscribeResize = host.metrics.onResize(() => scheduleFrame());

    // When a11y bridge is present, native DOM focus is authoritative — the bridge
    // owns Tab/keyboard navigation for semantic nodes. Skip the canvas focus
    // manager to prevent double-activation. The pointer dispatcher stays on so
    // mouse clicks still flow through the canvas pipeline.
    let unsubscribeKey: () => void = () => {};
    const dispatcher = host.a11y
      ? createPointerDispatcher(layered, {
          onHoverChange: (path) => host.setCursor?.(cursorOf(path)),
        })
      : (() => {
          const focus = createFocusManager(layered);
          const d = createPointerDispatcher(layered, {
            onPointerDown: (path) => focus.focusFromPointer(path),
            onHoverChange: (path) => host.setCursor?.(cursorOf(path)),
          });
          unsubscribeKey = host.input.onKey((e) => focus.handleKey(e));
          return d;
        })();

    const unsubscribePointer = host.input.onPointer((e) => dispatcher.handlePointer(e));
    const unsubscribeWheel = host.input.onWheel((e) => dispatcher.handleWheel(e));

    return () => {
      unsubscribePointer();
      unsubscribeWheel();
      unsubscribeKey();
      unsubscribeResize(); // avoid re-render on a disposed tree
      setFrameRequester(null);
      host.a11y?.dispose();
      dispose();
    };
  });
}
