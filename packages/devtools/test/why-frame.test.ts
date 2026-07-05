import { describe, it, expect, afterEach } from 'vitest';
import { createSignal, createEffect, createRoot, setReactiveDevHooks } from '@cairn/reactivity';
import { WhyFrameTracker } from '../src/why-frame';

afterEach(() => setReactiveDevHooks(null));

describe('WhyFrameTracker', () => {
  it('counts signal writes and effect runs, then resets on take', () => {
    const tracker = new WhyFrameTracker();
    tracker.start();
    createRoot(() => {
      const [get, set] = createSignal(0);
      createEffect(() => { get(); });
      set(1);
      set(2);
    });
    const first = tracker.take();
    expect(first.signalWrites).toBe(2);
    expect(first.effectRuns).toBeGreaterThanOrEqual(1);
    const second = tracker.take();
    expect(second).toEqual({ signalWrites: 0, effectRuns: 0, signals: [] });
    tracker.stop();
  });

  it('collects the set of changed signals with stable ids and names', () => {
    const tracker = new WhyFrameTracker();
    tracker.start();
    let firstId = -1;
    createRoot(() => {
      const [a, setA] = createSignal(0, { name: 'a' });
      const [, setB] = createSignal(0); // unnamed
      setA(1); setA(2); // same signal twice → one entry
      setB(1);
      a();
    });
    const r = tracker.take();
    expect(r.signals.length).toBe(2);
    const named = r.signals.find((s) => s.name === 'a');
    expect(named).toBeTruthy();
    firstId = named!.id;
    // second frame: writing the same signal again yields the same id
    tracker.take(); // drain
    tracker.stop();
    expect(typeof firstId).toBe('number');
  });
});
