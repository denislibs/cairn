export type EasingName = 'linear' | 'ease' | 'ease-in' | 'ease-out' | 'ease-in-out';
export type EasingFn = (t: number) => number;

// Cubic-bezier easing (P0=(0,0), P3=(1,1)), Newton-Raphson to invert x(t).
export function cubicBezier(x1: number, y1: number, x2: number, y2: number): EasingFn {
  const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx;
  const cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
  const sampleX = (t: number) => ((ax * t + bx) * t + cx) * t;
  const sampleY = (t: number) => ((ay * t + by) * t + cy) * t;
  const dX = (t: number) => (3 * ax * t + 2 * bx) * t + cx;
  return (x: number) => {
    if (x <= 0) return 0; if (x >= 1) return 1;
    let t = x;
    for (let i = 0; i < 8; i++) { const xe = sampleX(t) - x; if (Math.abs(xe) < 1e-5) break; const d = dX(t); if (Math.abs(d) < 1e-6) break; t -= xe / d; }
    return sampleY(Math.max(0, Math.min(1, t)));
  };
}
export const easings: Record<EasingName, EasingFn> = {
  linear: (t) => t,
  ease: cubicBezier(0.25, 0.1, 0.25, 1),
  'ease-in': cubicBezier(0.42, 0, 1, 1),
  'ease-out': cubicBezier(0, 0, 0.58, 1),
  'ease-in-out': cubicBezier(0.42, 0, 0.58, 1),
};
export function resolveEasing(e: EasingName | EasingFn | undefined): EasingFn {
  if (e === undefined) return easings.linear;
  if (typeof e === 'function') return e;
  return easings[e] ?? easings.linear;
}
// Approximate critically-damped-ish spring normalized to [0,1] over t∈[0,1]. Documented as approximate.
export function spring(stiffness = 4, damping = 6): EasingFn {
  return (t) => {
    if (t <= 0) return 0; if (t >= 1) return 1;
    const v = 1 - Math.exp(-damping * t) * Math.cos(stiffness * t);
    // normalize so f(1) ~ 1
    const norm = 1 - Math.exp(-damping) * Math.cos(stiffness);
    return v / norm;
  };
}
