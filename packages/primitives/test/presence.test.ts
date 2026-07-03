import { describe, it, expect } from 'vitest';
import { createRoot, runWithContext, createSignal } from '@cairn/reactivity';
import { hostContext } from '@cairn/runtime';
import { Presence } from '../src/presence';
import { Box } from '../src/box';

function fakeHost() {
  let pending: ((t: number) => void) | null = null;
  const host: any = { scheduler: { requestFrame(cb: any){ pending = cb; return 1; }, cancelFrame(){ pending = null; } }, renderer:{}, metrics:{}, input:{} };
  return { host, tick: (t: number) => { const cb = pending; pending = null; cb && cb(t); }, hasPending: () => pending !== null };
}

it('mounts child when when() is true', () => {
  createRoot(() => runWithContext(hostContext, fakeHost().host, () => {
    const [show] = createSignal(true);
    const p = Presence({ when: show, duration: 200, children: () => Box({ style: { width: 50, height: 50 } }) });
    expect(p.children.length).toBe(1);
  }));
});

it('keeps child during exit, removes after duration', () => {
  const { host, tick, hasPending } = fakeHost();
  createRoot(() => runWithContext(hostContext, host, () => {
    const [show, setShow] = createSignal(true);
    const p = Presence({ when: show, duration: 200, children: () => Box({ style: { width: 50, height: 50 } }) });
    expect(p.children.length).toBe(1);
    setShow(false);
    expect(p.children.length).toBe(1); // still mounted during exit
    let t = 0; for (let i = 0; i < 50 && hasPending(); i++) { t += 16; tick(t); }
    expect(p.children.length).toBe(0); // removed after exit
  }));
});

it('re-enter mid-exit cancels unmount', () => {
  const { host, tick, hasPending } = fakeHost();
  createRoot(() => runWithContext(hostContext, host, () => {
    const [show, setShow] = createSignal(true);
    const p = Presence({ when: show, duration: 200, children: () => Box({ style: { width: 50, height: 50 } }) });
    setShow(false);
    let t = 0; t += 16; tick(t); t += 16; tick(t); // partway through exit
    setShow(true); // re-enter
    for (let i = 0; i < 50 && hasPending(); i++) { t += 16; tick(t); }
    expect(p.children.length).toBe(1); // stayed mounted
  }));
});

it('starts hidden then becomes visible on enter (no throw)', () => {
  const { host, tick, hasPending } = fakeHost();
  createRoot(() => runWithContext(hostContext, host, () => {
    const [show, setShow] = createSignal(false);
    const p = Presence({ when: show, from: { opacity: 0 }, duration: 200, children: () => Box({ style: { width: 50, height: 50 } }) });
    expect(p.children.length).toBe(0);
    setShow(true);
    expect(p.children.length).toBe(1);
    let t = 0; for (let i = 0; i < 50 && hasPending(); i++) { t += 16; tick(t); }
    expect(p.children.length).toBe(1);
  }));
});
