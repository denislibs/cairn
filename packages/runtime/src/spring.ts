import { onCleanup } from '@cairn/reactivity';
import { useHost } from './host-context';

export interface SpringOptions {
  from: number;
  to: number;
  stiffness?: number;
  damping?: number;
  mass?: number;
  initialVelocity?: number;
  restDelta?: number;
  restSpeed?: number;
  onUpdate: (v: number) => void;
  onDone?: () => void;
}

export interface SpringHandle {
  cancel: () => void;
  velocity: () => number;
}

export function animateSpring(opts: SpringOptions): SpringHandle {
  const host = useHost();
  const k = opts.stiffness ?? 170;
  const c = opts.damping ?? 26;
  const m = opts.mass ?? 1;
  const restDelta = opts.restDelta ?? 0.01;
  const restSpeed = opts.restSpeed ?? 0.05;

  let x = opts.from;
  let v = opts.initialVelocity ?? 0;
  let last = -1;
  let handle = 0;
  let cancelled = false;

  const tick = (now: number): void => {
    if (cancelled) return;

    // First tick: record start time and re-queue so we get a valid dt next frame.
    if (last < 0) {
      last = now;
      handle = host.scheduler.requestFrame(tick);
      return;
    }

    let dt = (now - last) / 1000;
    last = now;

    // Clamp dt for numerical stability (skip frames if tab was backgrounded).
    if (dt > 1 / 30) dt = 1 / 30;
    if (dt <= 0) {
      handle = host.scheduler.requestFrame(tick);
      return;
    }

    // Semi-implicit Euler integration.
    const a = (-k * (x - opts.to) - c * v) / m;
    v += a * dt;
    x += v * dt;

    // Rest detection.
    if (Math.abs(x - opts.to) < restDelta && Math.abs(v) < restSpeed) {
      x = opts.to;
      v = 0;
      opts.onUpdate(x);
      opts.onDone?.();
      return;
    }

    opts.onUpdate(x);
    handle = host.scheduler.requestFrame(tick);
  };

  handle = host.scheduler.requestFrame(tick);

  const cancel = (): void => {
    cancelled = true;
    host.scheduler.cancelFrame(handle);
  };

  onCleanup(cancel);

  return { cancel, velocity: () => v };
}
