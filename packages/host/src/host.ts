import type { Renderer } from './renderer';
import type { FrameScheduler } from './scheduler';
import type { SurfaceMetrics } from './metrics';

// input / textInput / a11y are added in their own phases (7 / 8 / 14).
export interface Host {
  renderer: Renderer;
  scheduler: FrameScheduler;
  metrics: SurfaceMetrics;
}
