import type {
  FrameScheduler,
  SurfaceMetrics,
  Host,
  TextInputService,
  TextInputClient,
  TextEditingValue,
  AccessibilityBridge,
  SemanticsNodeData,
} from '@cairn/host';
import { createFakeRenderer } from './fake';

export function createFakeTextInput() {
  let client: TextInputClient | null = null;
  let lastInitial: TextEditingValue | null = null;
  const setValues: TextEditingValue[] = [];
  let closed = 0;
  const service: TextInputService = {
    start(c, initial) {
      client = c;
      lastInitial = initial;
      return {
        setValue(v) {
          setValues.push(v);
        },
        close() {
          closed += 1;
          client = null;
        },
      };
    },
  };
  return {
    service,
    get lastInitial() {
      return lastInitial;
    },
    setValues,
    get closed() {
      return closed;
    },
    emitChange(v: TextEditingValue) {
      client?.onChange(v);
    },
    emitSubmit() {
      client?.onSubmit?.();
    },
    emitCancel() {
      client?.onCancel?.();
    },
  };
}

/** Minimal a11y bridge stub — records synced nodes for inspection. */
export function createFakeA11yBridge(): AccessibilityBridge & { synced: SemanticsNodeData[] } {
  const synced: SemanticsNodeData[] = [];
  return {
    synced,
    sync(nodes) { synced.splice(0, synced.length, ...nodes); },
    focus() {},
    announce() {},
    dispose() {},
  };
}

export function createFakeHost(options?: { a11y?: boolean }) {
  const renderer = createFakeRenderer();
  const pending: Array<() => void> = [];
  const scheduler: FrameScheduler = {
    requestFrame(cb) {
      pending.push(() => cb(0));
      return pending.length;
    },
    cancelFrame() {},
  };
  const metrics: SurfaceMetrics = {
    width: 200,
    height: 100,
    devicePixelRatio: 1,
    onResize: () => () => {},
    dispose: () => {},
  };
  const input = { onPointer: () => () => {}, onWheel: () => () => {}, onKey: () => () => {} };
  const textInput = createFakeTextInput();
  const a11y = options?.a11y ? createFakeA11yBridge() : undefined;
  const host: Host = { renderer, scheduler, metrics, input, textInput: textInput.service, a11y };
  return {
    host,
    renderer,
    textInput,
    a11y: a11y ?? null,
    flush() {
      const q = pending.splice(0);
      for (const f of q) f();
    },
  };
}
