import type { Renderer } from '@cairn/host';
import { BoxNode } from '@cairn/layout';
import { type Instance, animate } from '@cairn/runtime';
import { createSignal, onCleanup } from '@cairn/reactivity';
import { alpha } from './colors';

export interface RippleHandle {
  instance: Instance;
  trigger(x: number, y: number): void;
}

interface Rip {
  id: number;
  x: number;
  y: number;
  p: () => number;
}

export function createRipple(opts: { color?: string; duration?: number; radius?: number } = {}): RippleHandle {
  const color = opts.color ?? 'rgba(0,0,0,1)';
  const duration = opts.duration ?? 450;
  const clipRadius = opts.radius ?? 0;
  const [ripples, setRipples] = createSignal<Rip[]>([]);
  const cancels = new Map<number, () => void>();
  let nextId = 1;

  const layout = new BoxNode({ width: '100%' as any, height: '100%' as any });
  const instance: Instance = {
    layout,
    children: [],
    paintSelf(r: Renderer) {
      const w = layout.size.w;
      const h = layout.size.h;
      const list = ripples();
      if (!list.length) return;
      r.save();
      r.clipRoundRect({ x: 0, y: 0, width: w, height: h }, clipRadius);
      for (const rp of list) {
        const p = rp.p();
        const maxR = Math.hypot(Math.max(rp.x, w - rp.x), Math.max(rp.y, h - rp.y));
        const R = maxR * p;
        r.fillRoundRect(
          { x: rp.x - R, y: rp.y - R, width: R * 2, height: R * 2 },
          R,
          { color: alpha(color, 0.3 * (1 - p)) },
        );
      }
      r.restore();
    },
  };

  const trigger = (x: number, y: number): void => {
    const id = nextId++;
    const [p, setP] = createSignal(0);
    setRipples([...ripples(), { id, x, y, p }]);
    const cancel = animate({
      from: 0,
      to: 1,
      duration,
      easing: 'ease-out',
      onUpdate: (v) => setP(v),
      onDone: () => {
        setRipples(ripples().filter((r) => r.id !== id));
        cancels.delete(id);
      },
    });
    cancels.set(id, cancel);
  };

  onCleanup(() => { for (const c of cancels.values()) c(); });
  return { instance, trigger };
}
