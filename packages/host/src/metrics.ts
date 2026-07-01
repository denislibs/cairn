export interface SurfaceMetrics {
  readonly width: number; // logical (CSS) pixels
  readonly height: number;
  readonly devicePixelRatio: number;
  onResize(cb: (metrics: SurfaceMetrics) => void): () => void; // returns unsubscribe
}
