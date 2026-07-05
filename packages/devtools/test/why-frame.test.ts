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
    expect(second).toEqual({ signalWrites: 0, effectRuns: 0 });
    tracker.stop();
  });
});
