import { describe, it, expect } from 'vitest';
import { createRoot, runWithContext, createSignal } from '@cairn/reactivity';
import { hostContext } from '@cairn/runtime';
import { createStyleTransitions } from '../src/transitions';

function fakeHostManualClock() {
  let pending: ((t: number) => void) | null = null;
  const host: any = { scheduler: { requestFrame(cb: any){ pending = cb; return 1; }, cancelFrame(){ pending = null; } }, renderer:{}, metrics:{}, input:{} };
  return { host, tick: (t: number) => { const cb = pending; pending = null; cb && cb(t); } };
}

describe('createStyleTransitions — structured props', () => {
  it('animates a transitioned width through intermediate numbers', () => {
    const { host, tick } = fakeHostManualClock();
    createRoot(() => runWithContext(hostContext, host, () => {
      const [w, setW] = createSignal(100);
      const resolved = () => ({ width: w(), transition: { properties: ['width'], duration: 100 } });
      const animated = createStyleTransitions(resolved);
      expect(animated().width).toBe(100);
      setW(200);
      tick(0); tick(50);
      expect(animated().width).toBeCloseTo(150, 0);
      tick(100);
      expect(animated().width).toBe(200);
    }));
  });

  it('animates a transform object per-field', () => {
    const { host, tick } = fakeHostManualClock();
    createRoot(() => runWithContext(hostContext, host, () => {
      const [scale, setScale] = createSignal(1);
      const resolved = () => ({ transform: { scale: scale() }, transition: { properties: ['transform'], duration: 100 } });
      const animated = createStyleTransitions(resolved);
      setScale(3);
      tick(0); tick(50);
      expect((animated().transform as any).scale).toBeCloseTo(2, 1);
    }));
  });

  it('object change detection: no tween when target deep-equal', () => {
    const { host, tick } = fakeHostManualClock();
    createRoot(() => runWithContext(hostContext, host, () => {
      const [tick2, setTick2] = createSignal(0);
      const resolved = () => { tick2(); return { transform: { scale: 2 }, transition: { properties:['transform'], duration: 100 } }; };
      const animated = createStyleTransitions(resolved);
      setTick2(1); // resolved re-runs but transform value is deep-equal → no new tween, value stays {scale:2}
      expect((animated().transform as any).scale).toBe(2);
    }));
  });

  it('non-transitioned prop snaps', () => {
    const { host } = fakeHostManualClock();
    createRoot(() => runWithContext(hostContext, host, () => {
      const [w, setW] = createSignal(100);
      const resolved = () => ({ width: w() }); // no transition
      const animated = createStyleTransitions(resolved);
      setW(300);
      expect(animated().width).toBe(300);
    }));
  });
});
