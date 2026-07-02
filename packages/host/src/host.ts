import type { Renderer } from './renderer';
import type { FrameScheduler } from './scheduler';
import type { SurfaceMetrics } from './metrics';
import type { InputSource } from './input';
import type { TextInputService } from './text-input';

// a11y is added in its own phase (14).
export interface Host {
  renderer: Renderer;
  scheduler: FrameScheduler;
  metrics: SurfaceMetrics;
  input: InputSource;
  textInput: TextInputService;
}
