import { createSignal, createEffect, untrack } from '@cairn/reactivity';
import { animate } from '@cairn/runtime';
import { interpolateValue, resolveEasing, type BaseStyle, type TransitionConfig } from '@cairn/style';

const ANIMATABLE = ['opacity', 'backgroundColor', 'color'] as const;
type Anim = (typeof ANIMATABLE)[number];

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

  createEffect(() => {
    const r = resolved();
    for (const p of ANIMATABLE) {
      const target = (r as any)[p];
      const [get, set] = sigs[p];
      const current = untrack(get);
      const cfg = configFor(r.transition, p);
      if (target === current) continue;
      cancels[p]?.();
      if (cfg && current !== undefined && target !== undefined) {
        const from = current, to = target;
        const ease = resolveEasing(cfg.easing);
        cancels[p] = animate({
          from: 0, to: 1, duration: cfg.duration, easing: ease, delay: cfg.delay,
          onUpdate: (t) => set(interpolateValue(from, to, t)),
          onDone: () => set(to),
        });
      } else {
        set(target); // snap
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
