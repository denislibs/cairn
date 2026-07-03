import { describe, it, expect } from 'vitest';
import { createRoot, runWithContext, createSignal } from '@cairn/reactivity';
import { hostContext } from '@cairn/runtime';
import { Row } from '../src/flex';
import { Grid } from '../src/grid';
import { ScrollView } from '../src/scroll-view';

function fakeHostManualClock() {
  let pending: ((t: number) => void) | null = null;
  const host: any = { scheduler: { requestFrame(cb: any){ pending = cb; return 1; }, cancelFrame(){ pending = null; } }, renderer:{}, metrics:{ width: 0, height: 0 }, input:{} };
  return { host, tick: (t: number) => { const cb = pending; pending = null; cb && cb(t); } };
}

it('Row animates a transitioned gap', () => {
  const { host, tick } = fakeHostManualClock();
  createRoot(() => runWithContext(hostContext, host, () => {
    const [gap, setGap] = createSignal(0);
    const row = Row({ style: () => ({ gap: gap(), transition: { properties: ['gap'], duration: 100 } }) });
    const node: any = row.layout;
    expect(node.gap).toBe(0);
    setGap(20);
    tick(0); tick(50);
    expect(node.gap).toBeCloseTo(10, 0); // mid-animation
    tick(100);
    expect(node.gap).toBe(20);
  }));
});

it('Grid routes through transitions (gap animates)', () => {
  const { host, tick } = fakeHostManualClock();
  createRoot(() => runWithContext(hostContext, host, () => {
    const [g, setG] = createSignal(0);
    const grid = Grid({ style: () => ({ gap: g(), gridTemplateColumns: '1fr 1fr', transition: { properties: ['gap'], duration: 100 } }) });
    const node: any = grid.layout;
    setG(30);
    tick(0); tick(100);
    // Grid's bind: layout.rowGap = s.rowGap ?? s.gap ?? 0 and layout.columnGap = s.columnGap ?? s.gap ?? 0
    // After full animation, gap=30 → columnGap should be 30
    expect(node.columnGap).toBe(30);
  }));
});

it('ScrollView routes through transitions (opacity animates on viewportInst)', () => {
  const { host, tick } = fakeHostManualClock();
  createRoot(() => runWithContext(hostContext, host, () => {
    const [op, setOp] = createSignal(1);
    // Use default scrollbar (stack wrapping): sv.children[0] is viewportInst
    // which has paintOpacity bound by the styleSource bind.
    const sv = ScrollView({ style: () => ({ opacity: op(), transition: { properties: ['opacity'], duration: 100 } }) });
    // viewportInst is sv.children[0]
    const viewportInst: any = sv.children[0];
    expect(viewportInst.paintOpacity).toBe(1);
    setOp(0);
    tick(0); tick(50);
    // mid-animation: paintOpacity should be ~0.5
    expect(viewportInst.paintOpacity).toBeCloseTo(0.5, 0);
    tick(100);
    expect(viewportInst.paintOpacity).toBeCloseTo(0, 1);
  }));
});
