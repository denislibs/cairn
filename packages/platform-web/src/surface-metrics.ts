import type { SurfaceMetrics } from '@cairn/host';

// How long after the last visualViewport event we treat a pinch gesture as
// settled and re-sync the backing store to the new scale.
const VV_SETTLE_MS = 150;

export class WebSurfaceMetrics implements SurfaceMetrics {
  // Declared mutable (the interface exposes them readonly to consumers); update()
  // rewrites them in place when the surface changes.
  width: number;
  height: number;
  devicePixelRatio: number;

  private subscribers = new Set<(m: SurfaceMetrics) => void>();
  private observer: ResizeObserver;
  private disposed = false;
  private currentMql?: MediaQueryList;
  private currentHandler?: () => void;
  private vvTimer: ReturnType<typeof setTimeout> | undefined;

  constructor(private element: HTMLElement) {
    this.width = element.clientWidth;
    this.height = element.clientHeight;
    this.devicePixelRatio = globalThis.devicePixelRatio ?? 1;

    this.observer = new ResizeObserver(() => this.update());
    this.observer.observe(element);
    this.watchDprChanges();
    this.watchVisualViewport();
  }

  // Pinch-zoom fires a burst of visualViewport events; its scale changes without
  // touching clientWidth/DPR, so update()'s guard would swallow it. Reacting to
  // every event would reallocate the (large) backing store per frame → jank.
  // Instead we DEBOUNCE: hold the current resolution during the gesture (the
  // compositor magnifies it — briefly soft), then notify once it settles so the
  // host re-syncs the backing to the final scale and repaints crisp.
  private onVisualViewport = (): void => {
    if (this.disposed) return;
    if (this.vvTimer !== undefined) clearTimeout(this.vvTimer);
    this.vvTimer = setTimeout(() => {
      this.vvTimer = undefined;
      if (this.disposed) return;
      for (const cb of this.subscribers) cb(this);
    }, VV_SETTLE_MS);
  };

  private watchVisualViewport(): void {
    const vv = globalThis.visualViewport;
    if (!vv) return;
    vv.addEventListener('resize', this.onVisualViewport);
    vv.addEventListener('scroll', this.onVisualViewport);
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
    const vv = globalThis.visualViewport;
    if (vv) {
      vv.removeEventListener('resize', this.onVisualViewport);
      vv.removeEventListener('scroll', this.onVisualViewport);
    }
    if (this.vvTimer !== undefined) clearTimeout(this.vvTimer);
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
