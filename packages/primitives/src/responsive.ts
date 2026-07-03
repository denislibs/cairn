import { createMemo } from '@cairn/reactivity';
import { useHost } from '@cairn/runtime';

export function pickBreakpoint(width: number, bps: Record<string, number>): string {
  let best = '';
  let bestMin = -Infinity;
  for (const [key, min] of Object.entries(bps)) {
    if (width >= min && min >= bestMin) {
      best = key;
      bestMin = min;
    }
  }
  if (best === '') {
    // width below all mins → smallest breakpoint
    let minKey = '';
    let m = Infinity;
    for (const [key, min] of Object.entries(bps)) {
      if (min < m) {
        m = min;
        minKey = key;
      }
    }
    best = minKey;
  }
  return best;
}

export function responsive<T>(
  map: Record<string, T>,
  current: string,
  order: string[],
): T | undefined {
  const idx = order.indexOf(current);
  for (let i = idx; i >= 0; i--) {
    const key = order[i];
    if (key in map) return map[key];
  }
  return undefined;
}

// Reactive accessor for the current viewport size (tracks SurfaceMetrics).
export function useViewport(): () => { w: number; h: number } {
  const host = useHost();
  return createMemo(() => ({ w: host.metrics.width, h: host.metrics.height }));
}

// Reactive accessor for the active breakpoint key.
export function useBreakpoint(bps: Record<string, number>): () => string {
  const vp = useViewport();
  return createMemo(() => pickBreakpoint(vp().w, bps));
}
