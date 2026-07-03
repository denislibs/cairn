import { describe, it, expect } from 'vitest';
import { createRoot, runWithContext } from '@cairn/reactivity';
import { hostContext } from '../src/host-context';
import { animateSpring } from '../src/spring';

function fakeHost() {
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

describe('animateSpring', () => {
  it('converges from → to and settles (onDone once)', () => {
    const { host, tick, hasPending } = fakeHost();
    createRoot(() => runWithContext(hostContext, host, () => {
      const vals: number[] = [];
      let dones = 0;
      animateSpring({ from: 0, to: 100, onUpdate: (v) => vals.push(v), onDone: () => dones++ });
      let t = 0;
      for (let i = 0; i < 500 && hasPending(); i++) { t += 16; tick(t); }
      expect(vals[vals.length - 1]).toBeCloseTo(100, 0);
      expect(dones).toBe(1);
    }));
  });

  it('underdamped overshoots past target', () => {
    const { host, tick, hasPending } = fakeHost();
    createRoot(() => runWithContext(hostContext, host, () => {
      const vals: number[] = [];
      animateSpring({ from: 0, to: 100, stiffness: 300, damping: 8, onUpdate: (v) => vals.push(v) });
      let t = 0;
      for (let i = 0; i < 500 && hasPending(); i++) { t += 16; tick(t); }
      expect(Math.max(...vals)).toBeGreaterThan(100); // overshoot
    }));
  });

  it('velocity() is nonzero mid-flight, ~0 at rest', () => {
    const { host, tick, hasPending } = fakeHost();
    createRoot(() => runWithContext(hostContext, host, () => {
      const s = animateSpring({ from: 0, to: 100, onUpdate: () => {} });
      let t = 0;
      t += 16; tick(t);
      t += 16; tick(t);
      expect(Math.abs(s.velocity())).toBeGreaterThan(0);
      for (let i = 0; i < 500 && hasPending(); i++) { t += 16; tick(t); }
      expect(Math.abs(s.velocity())).toBeLessThan(1);
    }));
  });

  it('cancel stops further updates', () => {
    const { host, tick, hasPending } = fakeHost();
    createRoot(() => runWithContext(hostContext, host, () => {
      const vals: number[] = [];
      const s = animateSpring({ from: 0, to: 100, onUpdate: (v) => vals.push(v) });
      let t = 16; tick(t);
      const n = vals.length;
      s.cancel();
      t += 16; tick(t);
      expect(vals.length).toBe(n);
      expect(hasPending()).toBe(false);
    }));
  });
});
