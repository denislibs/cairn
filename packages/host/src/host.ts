import type { Renderer } from './renderer';
import type { FrameScheduler } from './scheduler';
import type { SurfaceMetrics } from './metrics';
import type { InputSource } from './input';
import type { TextInputService } from './text-input';
import type { AccessibilityBridge } from './accessibility';

export interface Host {
  renderer: Renderer;
  scheduler: FrameScheduler;
  metrics: SurfaceMetrics;
  input: InputSource;
  textInput: TextInputService;
  setCursor?(cursor: string): void;
  // Load an image by URL (async, cached by the platform). Returns a drawable handle.
  loadImage?(url: string): Promise<import('./types').ImageHandle>;
  a11y?: AccessibilityBridge;
}
