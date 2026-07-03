import { animate } from './animate';
import type { EasingName, EasingFn } from '@cairn/style';

export interface Keyframe { at: number; value: number } // at ∈ [0,1]

export interface KeyframesOptions {
  duration: number; // total ms
  easing?: EasingName | EasingFn; // applied per segment
  onUpdate: (v: number) => void;
  onDone?: () => void;
}

// Run sequential tweens between successive keyframes (sorted by `at`).
export function animateKeyframes(frames: Keyframe[], opts: KeyframesOptions): () => void {
  const sorted = [...frames].sort((a, b) => a.at - b.at);
  if (sorted.length < 2) {
    if (sorted.length === 1) opts.onUpdate(sorted[0].value);
    opts.onDone?.();
    return () => {};
  }
  let cancelled = false;
  let cancelCurrent: (() => void) | null = null;
  let i = 0;
  const runSegment = (): void => {
    if (cancelled) return;
    if (i >= sorted.length - 1) { opts.onDone?.(); return; }
    const a = sorted[i], b = sorted[i + 1];
    const segDur = Math.max(0, (b.at - a.at) * opts.duration);
    cancelCurrent = animate({
      from: a.value, to: b.value, duration: segDur, easing: opts.easing,
      onUpdate: opts.onUpdate,
      onDone: () => { i++; runSegment(); },
    });
  };
  runSegment();
  return () => { cancelled = true; cancelCurrent?.(); };
}
