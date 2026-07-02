export interface SurfaceMetrics {
  readonly width: number; // logical (CSS) pixels
  readonly height: number;
  readonly devicePixelRatio: number;
  onResize(cb: (metrics: SurfaceMetrics) => void): () => void; // returns unsubscribe
  // Tear down any platform observers/listeners. Call when the surface goes away
  // (e.g. on unmount) to avoid leaks.
  dispose(): void;
}
