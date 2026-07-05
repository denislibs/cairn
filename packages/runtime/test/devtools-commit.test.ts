import { describe, it, expect, afterEach } from 'vitest';
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

  it('passes a numeric durationMs to onCommit', () => {
    let dur = -1;
    setRuntimeDevHooks({ onCommit: (_r, _v, d) => { dur = d; } });
    const { host } = createFakeHost();
    const app: Instance = { layout: { offsetX: 0, offsetY: 0, size: { w: 0, h: 0 }, layout: () => ({ w: 200, h: 100 }) } as any, children: [], paintSelf() {} };
    const dispose = mount(() => app, host);
    expect(typeof dur).toBe('number');
    expect(dur).toBeGreaterThanOrEqual(0);
    dispose();
  });
});
