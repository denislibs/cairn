import { describe, it, expect } from 'vitest';
import { createRoot, runWithContext, createSignal } from '@cairn/reactivity';
import { hostContext } from '@cairn/runtime';
import { createStyleTransitions } from '../src/transitions';

function fakeHost() {
  let pending: ((t: number) => void) | null = null;
  const host: any = { scheduler: { requestFrame(cb: any){ pending = cb; return 1; }, cancelFrame(){ pending = null; } }, renderer:{}, metrics:{}, input:{} };
  return { host, tick: (t: number) => { const cb = pending; pending = null; cb && cb(t); }, hasPending: () => pending !== null };
}

it('spring transition moves toward target and settles', () => {
  const { host, tick, hasPending } = fakeHost();
  createRoot(() => runWithContext(hostContext, host, () => {
    const [x, setX] = createSignal(0);
    const resolved = () => ({ opacity: x(), transition: { properties: ['opacity'], spring: { stiffness: 200, damping: 20 } } });
    const animated = createStyleTransitions(resolved);
    expect(animated().opacity).toBe(0);
    setX(1);
    let t = 0; for (let i = 0; i < 500 && hasPending(); i++) { t += 16; tick(t); }
    expect(animated().opacity).toBeCloseTo(1, 1);
  }));
});

it('retarget mid-flight continues to the new target (no throw, settles)', () => {
  const { host, tick, hasPending } = fakeHost();
  createRoot(() => runWithContext(hostContext, host, () => {
    const [x, setX] = createSignal(0);
    const resolved = () => ({ opacity: x(), transition: { properties: ['opacity'], spring: { stiffness: 170, damping: 26 } } });
    const animated = createStyleTransitions(resolved);
    setX(1);
    let t = 0; for (let i = 0; i < 6; i++) { t += 16; tick(t); } // partway
    const mid = animated().opacity as number;
    expect(mid).toBeGreaterThan(0); expect(mid).toBeLessThan(1);
    setX(0.5); // retarget mid-flight
    for (let i = 0; i < 500 && hasPending(); i++) { t += 16; tick(t); }
    expect(animated().opacity).toBeCloseTo(0.5, 1);
  }));
});
