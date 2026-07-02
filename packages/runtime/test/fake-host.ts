import type {
  Renderer,
  FrameScheduler,
  SurfaceMetrics,
  Host,
  InputSource,
  PointerInput,
  WheelInput,
  KeyboardInput,
} from '@cairn/host';

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

export function createFakeInput() {
  const pointerCbs = new Set<(e: PointerInput) => void>();
  const wheelCbs = new Set<(e: WheelInput) => void>();
  const keyCbs = new Set<(e: KeyboardInput) => void>();
  const input: InputSource = {
    onPointer(cb) {
      pointerCbs.add(cb);
      return () => pointerCbs.delete(cb);
    },
    onWheel(cb) {
      wheelCbs.add(cb);
      return () => wheelCbs.delete(cb);
    },
    onKey(cb) {
      keyCbs.add(cb);
      return () => keyCbs.delete(cb);
    },
  };
  return {
    input,
    emitPointer(e: PointerInput) {
      for (const cb of pointerCbs) cb(e);
    },
    emitWheel(e: WheelInput) {
      for (const cb of wheelCbs) cb(e);
    },
    emitKey(e: KeyboardInput) {
      for (const cb of keyCbs) cb(e);
    },
  };
}

export function createFakeHost() {
  const renderer = createFakeRenderer();
  const scheduler = createFakeScheduler();
  const metrics = createFakeMetrics();
  const input = createFakeInput();
  const host: Host = {
    renderer,
    scheduler: scheduler.scheduler,
    metrics: metrics.metrics,
    input: input.input,
  };
  return { host, renderer, scheduler, metrics, input };
}
