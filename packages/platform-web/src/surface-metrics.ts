import type { SurfaceMetrics } from '@cairn/host';

export class WebSurfaceMetrics implements SurfaceMetrics {
  width: number;
  height: number;
  devicePixelRatio: number;

  private subscribers = new Set<(m: SurfaceMetrics) => void>();
  private observer: ResizeObserver;
  private disposed = false;
  private currentMql?: MediaQueryList;
  private currentHandler?: () => void;

  constructor(private element: HTMLElement) {
    this.width = element.clientWidth;
    this.height = element.clientHeight;
    this.devicePixelRatio = globalThis.devicePixelRatio ?? 1;

    this.observer = new ResizeObserver(() => this.update());
    this.observer.observe(element);
    this.watchDprChanges();
  }

  onResize(cb: (m: SurfaceMetrics) => void): () => void {
    this.subscribers.add(cb);
    return () => {
      this.subscribers.delete(cb);
    };
  }

  // Tear down observers and listeners; safe to call once when the surface goes away.
  dispose(): void {
    this.disposed = true;
    this.observer.disconnect();
    if (this.currentMql && this.currentHandler) {
      this.currentMql.removeEventListener('change', this.currentHandler);
    }
    this.subscribers.clear();
  }

  private update(): void {
    const w = this.element.clientWidth;
    const h = this.element.clientHeight;
    const dpr = globalThis.devicePixelRatio ?? 1;
    if (w === this.width && h === this.height && dpr === this.devicePixelRatio) return;
    this.width = w;
    this.height = h;
    this.devicePixelRatio = dpr;
    for (const cb of this.subscribers) cb(this);
  }

  // Re-check on DPR changes (e.g. moving the window between monitors / zoom).
  private watchDprChanges(): void {
    if (this.disposed) return;
    const mql = matchMedia(`(resolution: ${this.devicePixelRatio}dppx)`);
    const handler = () => {
      // update() first so this.devicePixelRatio reflects the new value before
      // watchDprChanges() reads it to build the next DPR-specific query.
      this.update();
      this.watchDprChanges();
    };
    this.currentMql = mql;
    this.currentHandler = handler;
    mql.addEventListener('change', handler, { once: true });
  }
}
