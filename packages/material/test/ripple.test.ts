import { it, expect } from 'vitest';
import { createRoot, runWithContext } from '@cairn/reactivity';
import { hostContext } from '@cairn/runtime';
import { createRipple } from '../src/ripple';
import { recordingRenderer } from './recording-renderer';

function fakeHost() {
  let pending: ((t: number) => void) | null = null;
  const host: any = {
    scheduler: {
      requestFrame(cb: any) { pending = cb; return 1; },
      cancelFrame() { pending = null; },
    },
    renderer: {},
    metrics: {},
    input: {},
  };
  return {
    host,
    tick: (t: number) => { const cb = pending; pending = null; cb && cb(t); },
    hasPending: () => pending !== null,
  };
}

it('draws nothing before trigger; draws a circle after trigger; removed after done', () => {
  const { host, tick, hasPending } = fakeHost();
  createRoot(() => runWithContext(hostContext, host, () => {
    const rip = createRipple({ duration: 200, color: '#000000' });
    rip.instance.layout.size = { w: 100, h: 100 };

    // before trigger: nothing painted
    let rr = recordingRenderer();
    rip.instance.paintSelf(rr.r);
    expect(rr.calls.some((c) => c.name === 'fillRoundRect')).toBe(false);

    // after trigger: circle is painted
    rip.trigger(20, 20);
    rr = recordingRenderer();
    rip.instance.paintSelf(rr.r);
    expect(rr.calls.some((c) => c.name === 'fillRoundRect')).toBe(true);

    // run animation to completion
    let t = 0;
    for (let i = 0; i < 60 && hasPending(); i++) { t += 16; tick(t); }

    // after done: ripple removed, nothing painted
    rr = recordingRenderer();
    rip.instance.paintSelf(rr.r);
    expect(rr.calls.some((c) => c.name === 'fillRoundRect')).toBe(false);
  }));
});
