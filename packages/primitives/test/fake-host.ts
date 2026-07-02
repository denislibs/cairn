import type {
  FrameScheduler,
  SurfaceMetrics,
  Host,
  TextInputService,
  TextInputClient,
  TextEditingValue,
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

export function createFakeHost() {
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
  const host: Host = { renderer, scheduler, metrics, input, textInput: textInput.service };
  return {
    host,
    renderer,
    textInput,
    flush() {
      const q = pending.splice(0);
      for (const f of q) f();
    },
  };
}
