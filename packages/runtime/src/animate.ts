import { onCleanup } from '@cairn/reactivity';
import { resolveEasing, type EasingName, type EasingFn } from '@cairn/style';
import { useHost } from './host-context';

export interface AnimateOptions {
  from: number;
  to: number;
  duration: number; // ms
  easing?: EasingName | EasingFn;
  delay?: number; // ms
  onUpdate: (v: number) => void;
  onDone?: () => void;
}

// Frame-driven tween on the host scheduler. Returns a cancel function.
export function animate(opts: AnimateOptions): () => void {
  const host = useHost();
  const ease = resolveEasing(opts.easing);
  const delay = opts.delay ?? 0;
  const dur = Math.max(0, opts.duration);
  let start = -1;
  let handle = 0;
  let cancelled = false;

  const tick = (now: number): void => {
    if (cancelled) return;
    if (start < 0) start = now;
    const elapsed = now - start - delay;
    const t = dur === 0 ? 1 : Math.max(0, Math.min(1, elapsed / dur));
    // Only emit once we're past the delay (elapsed >= 0).
    if (elapsed >= 0) opts.onUpdate(opts.from + (opts.to - opts.from) * ease(t));
    if (t < 1) handle = host.scheduler.requestFrame(tick);
    else opts.onDone?.();
  };

  handle = host.scheduler.requestFrame(tick);
  const cancel = (): void => { cancelled = true; host.scheduler.cancelFrame(handle); };
  onCleanup(cancel);
  return cancel;
}
