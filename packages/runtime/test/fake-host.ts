import type { Renderer, FrameScheduler, SurfaceMetrics, Host } from '@cairn/host';

export function createFakeRenderer(): Renderer & { calls: unknown[][] } {
  const calls: unknown[][] = [];
  const rec = (name: string) => (...args: unknown[]) => {
    calls.push([name, ...args]);
  };
  const r = {
    calls,
    resize: rec('resize'),
    beginFrame: rec('beginFrame'),
    endFrame: rec('endFrame'),
    clear: rec('clear'),
    save: rec('save'),
    restore: rec('restore'),
    translate: rec('translate'),
    scale: rec('scale'),
    clipRect: rec('clipRect'),
    setShadow: rec('setShadow'),
    fillRect: rec('fillRect'),
    strokeRect: rec('strokeRect'),
    fillRoundRect: rec('fillRoundRect'),
    strokeRoundRect: rec('strokeRoundRect'),
    fillPath: rec('fillPath'),
    strokePath: rec('strokePath'),
    drawText: rec('drawText'),
    measureText: (text: string, style: unknown) => {
      calls.push(['measureText', text, style]);
      return { width: text.length * 7 };
    },
    drawImage: rec('drawImage'),
  };
  return r as unknown as Renderer & { calls: unknown[][] };
}

export function createFakeScheduler() {
  const pending: Array<() => void> = [];
  const scheduler: FrameScheduler = {
    requestFrame(cb) {
      pending.push(() => cb(0));
      return pending.length;
    },
    cancelFrame() {},
  };
  return {
    scheduler,
    pending,
    flush() {
      const q = pending.splice(0);
      for (const f of q) f();
    },
  };
}

export function createFakeMetrics(width = 200, height = 100) {
  const subs: Array<(m: SurfaceMetrics) => void> = [];
  const m = {
    width,
    height,
    devicePixelRatio: 1,
    onResize(cb: (m: SurfaceMetrics) => void) {
      subs.push(cb);
      return () => {};
    },
    dispose() {},
  };
  return {
    metrics: m as SurfaceMetrics,
    resize(w: number, h: number) {
      m.width = w;
      m.height = h;
      subs.forEach((s) => s(m as SurfaceMetrics));
    },
  };
}

export function createFakeHost() {
  const renderer = createFakeRenderer();
  const scheduler = createFakeScheduler();
  const metrics = createFakeMetrics();
  const host: Host = {
    renderer,
    scheduler: scheduler.scheduler,
    metrics: metrics.metrics,
  };
  return { host, renderer, scheduler, metrics };
}
