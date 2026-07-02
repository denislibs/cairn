import type { Host } from '@cairn/host';
import { HtmlCanvasSurface } from './canvas-surface';
import { Canvas2DRenderer } from './canvas2d-renderer';
import { WebFrameScheduler } from './frame-scheduler';
import { WebSurfaceMetrics } from './surface-metrics';
import { WebInputSource } from './web-input-source';

export function createWebHost(canvas: HTMLCanvasElement): Host {
  const renderer = new Canvas2DRenderer(new HtmlCanvasSurface(canvas));
  const scheduler = new WebFrameScheduler();
  const metrics = new WebSurfaceMetrics(canvas);

  const configure = () => renderer.resize(metrics.width, metrics.height, metrics.devicePixelRatio);
  configure(); // initial sizing
  metrics.onResize(configure); // keep backing store in sync

  const input = new WebInputSource(canvas);

  // Placeholder; replaced by WebTextInputService in a later task.
  const textInput = { start: () => ({ setValue() {}, close() {} }) };

  return { renderer, scheduler, metrics, input, textInput };
}
