import { createSignal, createEffect, untrack } from '@cairn/reactivity';
import { animate, animateSpring, type SpringHandle } from '@cairn/runtime';
import { interpolateValue, resolveEasing, type BaseStyle, type TransitionConfig } from '@cairn/style';

const ANIMATABLE = [
  'opacity', 'backgroundColor', 'color',
  'width', 'height', 'minWidth', 'maxWidth', 'minHeight', 'maxHeight',
  'padding', 'margin', 'gap',
  'borderRadius', 'border', 'boxShadow',
  'transform',
  'letterSpacing', 'lineHeight',
] as const;
type Anim = (typeof ANIMATABLE)[number];

function valuesEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a == null || b == null) return false;
  if (typeof a === 'object' && typeof b === 'object') {
    try { return JSON.stringify(a) === JSON.stringify(b); } catch { return false; }
  }
  return false;
}

function configFor(transition: BaseStyle['transition'], prop: string): TransitionConfig | undefined {
  if (!transition) return undefined;
  const list = Array.isArray(transition) ? transition : [transition];
  return list.find((c) => !c.properties || c.properties.includes(prop));
}

// Wrap a resolved-style accessor so transitioned animatable props tween on change.
export function createStyleTransitions(resolved: () => BaseStyle): () => BaseStyle {
  // Per-prop displayed-value signal, seeded from the initial resolved value.
  const init = untrack(resolved);
  const sigs = {} as Record<Anim, [() => unknown, (v: unknown) => void]>;
  for (const p of ANIMATABLE) {
    const [get, set] = createSignal<unknown>((init as any)[p]);
    sigs[p] = [get, set];
  }
  const cancels: Partial<Record<Anim, () => void>> = {};
  // Spring handles keyed by prop — tracks velocity for carry-over on retarget.
  const springs: Partial<Record<Anim, SpringHandle>> = {};

  createEffect(() => {
    const r = resolved();
    for (const p of ANIMATABLE) {
      const target = (r as any)[p];
      const [get, set] = sigs[p];
      const current = untrack(get);
      const cfg = configFor(r.transition, p);
      if (valuesEqual(target, current)) continue;

      if (cfg && current !== undefined && target !== undefined) {
        const fromVal = current, toVal = target;
        if (cfg.spring) {
          // Carry velocity from any in-progress spring (in progress-space 0→1).
          const carry = springs[p]?.velocity() ?? 0;
          springs[p]?.cancel();
          cancels[p]?.();
          springs[p] = animateSpring({
            from: 0, to: 1,
            stiffness: cfg.spring.stiffness,
            damping: cfg.spring.damping,
            mass: cfg.spring.mass,
            initialVelocity: carry,
            onUpdate: (prog) => set(interpolateValue(fromVal, toVal, prog)),
            onDone: () => set(toVal),
          });
          cancels[p] = springs[p]!.cancel;
        } else {
          // Time-based tween — cancel any spring first.
          springs[p]?.cancel();
          springs[p] = undefined;
          cancels[p]?.();
          const ease = resolveEasing(cfg.easing);
          cancels[p] = animate({
            from: 0, to: 1, duration: cfg.duration!, easing: ease, delay: cfg.delay,
            onUpdate: (t) => set(interpolateValue(fromVal, toVal, t)),
            onDone: () => set(toVal),
          });
        }
      } else {
        // Snap — cancel any running animation.
        springs[p]?.cancel();
        springs[p] = undefined;
        cancels[p]?.();
        cancels[p] = undefined;
        set(target);
      }
    }
  });

  return () => {
    const r = resolved();
    const out: any = { ...r };
    for (const p of ANIMATABLE) {
      const v = sigs[p][0]();
      if (v !== undefined) out[p] = v;
    }
    return out as BaseStyle;
  };
}
