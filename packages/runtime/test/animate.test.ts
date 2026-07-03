import { describe, it, expect } from 'vitest';
import { createRoot, runWithContext } from '@cairn/reactivity';
import { hostContext } from '../src/host-context';
import { animate } from '../src/animate';

function fakeHostWithManualClock() {
  let pending: ((t: number) => void) | null = null;
  const host: any = {
    scheduler: {
      requestFrame(cb: (t: number) => void) { pending = cb; return 1; },
      cancelFrame() { pending = null; },
    },
    renderer: {}, metrics: {}, input: {},
  };
  const tick = (t: number) => { const cb = pending; pending = null; if (cb) cb(t); };
  return { host, tick, hasPending: () => pending !== null };
}

describe('animate', () => {
  it('drives from→to over duration and calls onDone', () => {
    const { host, tick } = fakeHostWithManualClock();
    createRoot(() => runWithContext(hostContext, host, () => {
      const values: number[] = [];
      let done = false;
      animate({ from: 0, to: 100, duration: 100, onUpdate: (v) => values.push(v), onDone: () => { done = true; } });
      tick(1000);        // first tick → start=1000, t=0 → 0
      tick(1050);        // t=0.5 → 50
      tick(1100);        // t=1 → 100, done
      expect(values[0]).toBe(0);
      expect(values).toContain(50);
      expect(values[values.length - 1]).toBe(100);
      expect(done).toBe(true);
    }));
  });

  it('cancel stops further updates', () => {
    const { host, tick, hasPending } = fakeHostWithManualClock();
    createRoot(() => runWithContext(hostContext, host, () => {
      const values: number[] = [];
      const cancel = animate({ from: 0, to: 10, duration: 100, onUpdate: (v) => values.push(v) });
      tick(0);       // start, t=0 → 0
      cancel();
      tick(50);      // should not fire
      expect(values).toEqual([0]);
      expect(hasPending()).toBe(false);
    }));
  });
});
