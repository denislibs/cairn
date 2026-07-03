import { describe, it, expect } from 'vitest';
import { createRoot, runWithContext } from '@cairn/reactivity';
import { hostContext } from '../src/host-context';
import { animateKeyframes } from '../src/keyframes';

function fakeHostManualClock() {
  let pending: ((t: number) => void) | null = null;
  const host: any = {
    scheduler: {
      requestFrame(cb: any) { pending = cb; return 1; },
      cancelFrame() { pending = null; },
    },
    renderer: {}, metrics: {}, input: {},
  };
  return { host, tick: (t: number) => { const cb = pending; pending = null; cb && cb(t); }, hasPending: () => pending !== null };
}

describe('animateKeyframes', () => {
  it('runs sequential segments across keyframes', () => {
    const { host, tick } = fakeHostManualClock();
    createRoot(() => runWithContext(hostContext, host, () => {
      const values: number[] = [];
      let done = false;
      // frames: 0 → 10 (first half), 10 → 30 (second half); total duration 200ms
      animateKeyframes(
        [{ at: 0, value: 0 }, { at: 0.5, value: 10 }, { at: 1, value: 30 }],
        { duration: 200, onUpdate: (v) => values.push(v), onDone: () => { done = true; } },
      );
      // segment 1: duration 100 (0.5*200), 0 → 10
      tick(0);    // start seg1 → records start, t=0 → emits 0
      tick(100);  // seg1 end → 10, then seg2 starts (seg2 requestFrame enqueued)
      // segment 2: duration 100, 10 → 30
      tick(100);  // seg2 start captured → emits 10
      tick(200);  // seg2 end → 30, done
      expect(values[0]).toBe(0);
      expect(values).toContain(10);
      expect(values[values.length - 1]).toBe(30);
      expect(done).toBe(true);
    }));
  });

  it('calls onDone immediately for a single keyframe', () => {
    const { host } = fakeHostManualClock();
    createRoot(() => runWithContext(hostContext, host, () => {
      const values: number[] = [];
      let done = false;
      animateKeyframes(
        [{ at: 0, value: 42 }],
        { duration: 100, onUpdate: (v) => values.push(v), onDone: () => { done = true; } },
      );
      expect(values).toEqual([42]);
      expect(done).toBe(true);
    }));
  });

  it('cancel stops further updates', () => {
    const { host, tick, hasPending } = fakeHostManualClock();
    createRoot(() => runWithContext(hostContext, host, () => {
      const values: number[] = [];
      const cancel = animateKeyframes(
        [{ at: 0, value: 0 }, { at: 1, value: 100 }],
        { duration: 100, onUpdate: (v) => values.push(v) },
      );
      tick(0);    // start, t=0 → 0
      cancel();
      tick(50);   // should not fire
      expect(values).toEqual([0]);
      expect(hasPending()).toBe(false);
    }));
  });

  it('sorts keyframes by at position', () => {
    const { host, tick } = fakeHostManualClock();
    createRoot(() => runWithContext(hostContext, host, () => {
      const values: number[] = [];
      let done = false;
      // provide frames out of order
      animateKeyframes(
        [{ at: 1, value: 100 }, { at: 0, value: 0 }],
        { duration: 100, onUpdate: (v) => values.push(v), onDone: () => { done = true; } },
      );
      tick(0);    // t=0 → 0
      tick(100);  // t=1 → 100, done
      expect(values[0]).toBe(0);
      expect(values[values.length - 1]).toBe(100);
      expect(done).toBe(true);
    }));
  });
});
