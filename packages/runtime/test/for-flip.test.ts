import { describe, it, expect } from 'vitest';
import { createRoot, runWithContext, createSignal } from '@cairn/reactivity';
import { hostContext } from '../src/host-context';
import { For } from '../src/for';
import { flushAfterLayout } from '../src/scheduler';
import { BoxNode } from '@cairn/layout';

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
function item(id: string) { return { id }; }

it('flip sets an inverted transform on a moved item, then animates it to identity', () => {
  const { host, tick, hasPending } = fakeHost();
  createRoot(() => runWithContext(hostContext, host, () => {
    const [list, setList] = createSignal([item('a'), item('b'), item('c')]);
    const For_ = For({
      each: list,
      key: (i: any) => i.id,
      flip: { duration: 200 },
      children: (i: any) => ({ layout: new BoxNode({}), children: [], paintSelf() {} }),
    });
    // simulate initial layout: assign offsetY 0/50/100 in order a,b,c
    For_.children.forEach((c, idx) => { c.layout.offsetY = idx * 50; c.layout.offsetX = 0; });
    // reorder → c,a,b
    setList([item('c'), item('a'), item('b')]);
    // simulate new layout offsets for the reordered children (now order c,a,b → y 0,50,100)
    For_.children.forEach((c, idx) => { c.layout.offsetY = idx * 50; c.layout.offsetX = 0; });
    // run the queued onNextLayout (FLIP invert)
    flushAfterLayout();
    // 'a' moved from y=50 (old index 0 in a,b,c) to y=50 (new index 1 in c,a,b) → wait
    // Actually: old offsets: a=0, b=50, c=100. new offsets: c=0, a=50, b=100.
    // 'a' moved from y=0 to y=50 → invert translateY = 0 - 50 = -50. Find child at index 1 (a)
    const a = For_.children[1];
    expect(a.transform).toBeTruthy();
    expect((a.transform as any).translateY).toBeCloseTo(-50, 0); // old(0) - new(50)
    // play: drive the clock → transform settles toward 0 then clears
    let t = 0;
    for (let i = 0; i < 40 && hasPending(); i++) { t += 16; tick(t); }
    expect(a.transform == null || Math.abs((a.transform as any).translateY ?? 0) < 1).toBe(true);
  }));
});

it('no flip prop → children get no transform on reorder', () => {
  const { host } = fakeHost();
  createRoot(() => runWithContext(hostContext, host, () => {
    const [list, setList] = createSignal([item('a'), item('b')]);
    const For_ = For({
      each: list,
      key: (i: any) => i.id,
      children: (i: any) => ({ layout: new BoxNode({}), children: [], paintSelf() {} }),
    });
    For_.children.forEach((c, idx) => { c.layout.offsetY = idx * 50; });
    setList([item('b'), item('a')]);
    flushAfterLayout();
    expect(For_.children.every((c) => c.transform == null)).toBe(true);
  }));
});
