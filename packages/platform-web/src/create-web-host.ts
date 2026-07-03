import type { Host, FrameScheduler } from '@cairn/host';
import { HtmlCanvasSurface } from './canvas-surface';
import { Canvas2DRenderer } from './canvas2d-renderer';
import { WebFrameScheduler } from './frame-scheduler';
import { WebSurfaceMetrics } from './surface-metrics';
import { WebInputSource } from './web-input-source';
import { WebTextInputService } from './web-text-input';
import { createImageLoader } from './image-loader';
import { WebAccessibilityBridge } from './web-accessibility';

export function createWebHost(canvas: HTMLCanvasElement): Host {
  const renderer = new Canvas2DRenderer(new HtmlCanvasSurface(canvas));
  const baseScheduler = new WebFrameScheduler();
  const metrics = new WebSurfaceMetrics(canvas);

  // Self-healing size sync. Reads the LIVE CSS size + devicePixelRatio + pinch-zoom
  // scale (not the cached metrics, which can lag behind a DPR change from browser
  // zoom or moving the window between monitors) and re-sizes the backing store.
  // renderer.resize is idempotent, so this is a cheap no-op when nothing changed.
  //
  // pinch-zoom (trackpad gesture) changes visualViewport.scale but NOT
  // devicePixelRatio — the compositor just magnifies the existing raster, which
  // blurs a canvas. Folding scale into the backing resolution keeps text crisp
  // while pinched. Capped so the backing never exceeds the GPU's max texture size.
  const MAX_BACKING_DIM = 8192;
  const MAX_SCALE = 3;
  const syncSize = (): void => {
    const dpr = globalThis.devicePixelRatio ?? 1;
    const scale = globalThis.visualViewport?.scale ?? 1;
    let ratio = dpr * Math.min(scale, MAX_SCALE);
    const longest = Math.max(canvas.clientWidth, canvas.clientHeight) * ratio;
    if (longest > MAX_BACKING_DIM) ratio *= MAX_BACKING_DIM / longest;
    renderer.resize(canvas.clientWidth, canvas.clientHeight, ratio);
  };
  syncSize(); // initial sizing
  metrics.onResize(syncSize); // sync immediately on a detected surface change

  // Sync the backing store to the current CSS size × DPR at the START of every
  // frame. This guarantees crisp output even if a DPR change slips past the
  // event-based detectors (matchMedia / ResizeObserver) — the classic cause of
  // blurry canvas text after browser zoom on a HiDPI display.
  const scheduler: FrameScheduler = {
    requestFrame: (cb) => baseScheduler.requestFrame((t) => { syncSize(); cb(t); }),
    cancelFrame: (h) => baseScheduler.cancelFrame(h),
  };

  const input = new WebInputSource(canvas);

  const textInput = new WebTextInputService();
  const loadImage = createImageLoader();

  return {
    renderer,
    scheduler,
    metrics,
    input,
    textInput,
    setCursor: (cursor: string) => { canvas.style.cursor = cursor; },
    loadImage,
    a11y: new WebAccessibilityBridge(canvas),
  };
}
