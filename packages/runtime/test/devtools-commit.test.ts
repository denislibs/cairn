import { describe, it, expect, afterEach } from 'vitest';
import { vi } from 'vitest';
import { mount } from '../src/mount';
import { setRuntimeDevHooks } from '../src/devtools-hook';
import type { Instance } from '../src/instance';
import { createFakeHost } from './fake-host';

afterEach(() => setRuntimeDevHooks(null));

describe('runtime commit hook', () => {
  it('calls onCommit with the app root and viewport after a frame', () => {
    const calls: Array<{ root: Instance; viewport: { w: number; h: number } }> = [];
    setRuntimeDevHooks({ onCommit: (root, viewport) => calls.push({ root, viewport }) });

    const { host } = createFakeHost();
    const app: Instance = {
      layout: { offsetX: 0, offsetY: 0, size: { w: 0, h: 0 }, layout: () => ({ w: 200, h: 100 }) } as any,
      children: [], paintSelf() {},
    };
    const dispose = mount(() => app, host);
    expect(calls.length).toBeGreaterThanOrEqual(1);
    expect(calls[0].root).toBe(app);
    expect(calls[0].viewport).toEqual({ w: 200, h: 100 });
    dispose();
  });

  it('passes per-phase FrameTiming to onCommit', () => {
    // Fake performance.now to a fixed sequence: t0, tLayout, tA11y, tPaint
    const seq = [0, 5, 5, 12];
    let i = 0;
    const spy = vi.spyOn(performance, 'now').mockImplementation(() => seq[Math.min(i++, seq.length - 1)]);

    let timing: any = null;
    setRuntimeDevHooks({ onCommit: (_r, _v, t) => { timing = t; } });
    const { host } = createFakeHost(); // no a11y bridge
    const app: Instance = { layout: { offsetX: 0, offsetY: 0, size: { w: 0, h: 0 }, layout: () => ({ w: 200, h: 100 }) } as any, children: [], paintSelf() {} };
    const dispose = mount(() => app, host);

    expect(timing).toBeTruthy();
    expect(timing.total).toBe(12);
    expect(timing.layout).toBe(5);
    expect(timing.a11y).toBe(0);   // no host.a11y → measured immediately after layout
    expect(timing.paint).toBe(7);
    dispose();
    spy.mockRestore();
  });
});
