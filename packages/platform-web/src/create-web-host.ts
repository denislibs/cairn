import type { Host, FrameScheduler } from '@cairn/host';
import { HtmlCanvasSurface } from './canvas-surface';
import { Canvas2DRenderer } from './canvas2d-renderer';
import { WebFrameScheduler } from './frame-scheduler';
import { WebSurfaceMetrics } from './surface-metrics';
import { WebInputSource } from './web-input-source';
import { WebTextInputService } from './web-text-input';
import { createImageLoader } from './image-loader';

export function createWebHost(canvas: HTMLCanvasElement): Host {
  const renderer = new Canvas2DRenderer(new HtmlCanvasSurface(canvas));
  const baseScheduler = new WebFrameScheduler();
  const metrics = new WebSurfaceMetrics(canvas);

  // Self-healing size sync. Reads the LIVE CSS size + devicePixelRatio (not the
  // cached metrics, which can lag behind a DPR change from zoom or moving the
  // window between monitors) and re-sizes the backing store. renderer.resize is
  // idempotent, so this is a cheap no-op when nothing changed.
  const syncSize = (): void => {
    const dpr = globalThis.devicePixelRatio ?? 1;
    renderer.resize(canvas.clientWidth, canvas.clientHeight, dpr);
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
  };
}
