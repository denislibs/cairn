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

  it('collects changed signals with stable ids across frames', () => {
    const tracker = new WhyFrameTracker();
    tracker.start();
    let setA!: (v: number) => void;
    createRoot(() => {
      const [a, sa] = createSignal(0, { name: 'a' });
      const [, sb] = createSignal(0); // unnamed
      setA = sa as any;
      sa(1); sa(2);   // same signal twice → one entry
      sb(1);
      a();
    });
    const f1 = tracker.take();
    expect(f1.signals.length).toBe(2);
    const aRef = f1.signals.find((s) => s.name === 'a');
    expect(aRef).toBeTruthy();
    const firstId = aRef!.id;
    // second frame: write the same signal again — id must be identical
    setA(3);
    const f2 = tracker.take();
    const aRef2 = f2.signals.find((s) => s.name === 'a');
    expect(aRef2).toBeTruthy();
    expect(aRef2!.id).toBe(firstId);
    tracker.stop();
  });
});
