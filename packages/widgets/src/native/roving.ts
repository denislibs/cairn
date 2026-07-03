import { createSignal, type Accessor } from '@cairn/reactivity';

export interface RovingOptions {
  count: Accessor<number>;
  orientation?: 'vertical' | 'horizontal' | 'both';
  loop?: boolean;
  initial?: number;
}

export interface RovingResult {
  active: Accessor<number>;
  setActive: (i: number) => void;
  handleKey: (key: string) => boolean;
}

export function createRoving(opts: RovingOptions): RovingResult {
  const [active, setActive] = createSignal(opts.initial ?? 0);
  const orientation = opts.orientation ?? 'vertical';
  const loop = opts.loop ?? false;

  function handleKey(key: string): boolean {
    const n = opts.count();
    if (n === 0) return false;

    const cur = active();

    let delta = 0;
    if ((orientation === 'vertical' || orientation === 'both') && key === 'ArrowUp') delta = -1;
    else if ((orientation === 'vertical' || orientation === 'both') && key === 'ArrowDown') delta = 1;
    else if ((orientation === 'horizontal' || orientation === 'both') && key === 'ArrowLeft') delta = -1;
    else if ((orientation === 'horizontal' || orientation === 'both') && key === 'ArrowRight') delta = 1;
    else if (key === 'Home') { setActive(0); return true; }
    else if (key === 'End') { setActive(n - 1); return true; }
    else return false;

    let next = cur + delta;
    if (loop) {
      next = ((next % n) + n) % n;
    } else {
      next = Math.max(0, Math.min(n - 1, next));
    }
    if (next !== cur) setActive(next);
    return true;
  }

  return { active, setActive, handleKey };
}
