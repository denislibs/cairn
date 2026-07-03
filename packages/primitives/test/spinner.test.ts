import { describe, it, expect } from 'vitest';
import { createRoot, runWithContext } from '@cairn/reactivity';
import { hostContext } from '@cairn/runtime';
import { Spinner } from '../src/spinner';
import { recordingRenderer } from './recording-renderer';

function fakeHost() {
  let pending: ((t: number) => void) | null = null;
  const host: any = { scheduler: { requestFrame(cb: any){ pending = cb; return 1; }, cancelFrame(){ pending = null; } }, renderer:{}, metrics:{}, input:{} };
  return { host, tick: (t: number) => { const cb = pending; pending = null; cb && cb(t); }, hasPending: () => pending !== null };
}

it('requests a frame on creation and strokes an arc', () => {
  const { host, hasPending } = fakeHost();
  createRoot(() => runWithContext(hostContext, host, () => {
    const s = Spinner({ size: 24 });
    expect(hasPending()).toBe(true); // animation loop started
    s.layout.size = { w: 24, h: 24 };
    const { r, calls } = recordingRenderer();
    s.paintSelf(r);
    expect(calls.some((c) => c.name === 'strokePath')).toBe(true);
  }));
});

it('advances angle across frames', () => {
  const { host, tick } = fakeHost();
  createRoot(() => runWithContext(hostContext, host, () => {
    const s = Spinner({ size: 24 });
    s.layout.size = { w: 24, h: 24 };
    const grab = () => { const { r, calls } = recordingRenderer(); s.paintSelf(r); return calls.find((c) => c.name === 'strokePath'); };
    const first = grab();
    tick(16); tick(32);
    const second = grab();
    // the arc path commands differ after ticks (angle advanced)
    expect(JSON.stringify(second!.args[0])).not.toBe(JSON.stringify(first!.args[0]));
  }));
});
