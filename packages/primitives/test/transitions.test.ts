import { it, expect } from 'vitest';
import { createRoot, createSignal, runWithContext } from '@cairn/reactivity';
import { hostContext } from '@cairn/runtime';
import { createStyleTransitions } from '../src/transitions';

function fakeHostManualClock() {
  let pending: ((t: number) => void) | null = null;
  const host: any = { scheduler: { requestFrame(cb: any){ pending = cb; return 1; }, cancelFrame(){ pending = null; } }, renderer:{}, metrics:{}, input:{} };
  return { host, tick: (t: number) => { const cb = pending; pending = null; cb && cb(t); }, hasPending: () => pending !== null };
}

it('animates a transitioned opacity change instead of snapping', () => {
  const { host, tick } = fakeHostManualClock();
  createRoot(() => runWithContext(hostContext, host, () => {
    const [op, setOp] = createSignal(1);
    const resolved = () => ({ opacity: op(), transition: { properties: ['opacity'], duration: 100 } });
    const animated = createStyleTransitions(resolved);
    expect(animated().opacity).toBe(1);      // initial = target
    setOp(0);                                 // target changes 1 → 0
    // effect starts a tween; drive the clock
    tick(0);    // start, t=0 → still 1
    tick(50);   // t=0.5 → 0.5
    expect(animated().opacity).toBeCloseTo(0.5, 2);
    tick(100);  // t=1 → 0
    expect(animated().opacity).toBeCloseTo(0, 2);
  }));
});

it('snaps a non-transitioned property', () => {
  const { host } = fakeHostManualClock();
  createRoot(() => runWithContext(hostContext, host, () => {
    const [op, setOp] = createSignal(1);
    const resolved = () => ({ opacity: op() }); // no transition
    const animated = createStyleTransitions(resolved);
    setOp(0.2);
    expect(animated().opacity).toBe(0.2); // immediate
  }));
});
