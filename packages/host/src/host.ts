import type { Renderer } from './renderer';
import type { FrameScheduler } from './scheduler';
import type { SurfaceMetrics } from './metrics';
import type { InputSource } from './input';

// textInput / a11y are added in their own phases (8 / 14).
export interface Host {
  renderer: Renderer;
  scheduler: FrameScheduler;
  metrics: SurfaceMetrics;
  input: InputSource;
}
