import { describe, it, expect } from 'vitest';
import { createRoot, runWithContext } from '@cairn/reactivity';
import { hostContext } from '@cairn/runtime';
import { ScrollView } from '../src/scroll-view';
import { Box } from '../src/box';

function fakeHost() {
  let pending: ((t: number) => void) | null = null;
  const host: any = { scheduler: { requestFrame(cb: any){ pending = cb; return 1; }, cancelFrame(){ pending = null; } }, renderer:{}, metrics:{}, input:{} };
  return { host, tick: (t: number) => { const cb = pending; pending = null; cb && cb(t); }, hasPending: () => pending !== null };
}

it('fling after drag keeps scrolling then settles', () => {
  const { host, tick, hasPending } = fakeHost();
  createRoot(() => runWithContext(hostContext, host, () => {
    const inst = ScrollView({ scrollbar: false, children: Box({ style: { width: 80, height: 2000 } }) });
    const node: any = inst.layout; node.maxScrollY = 1900; node.viewportH = 100; node.contentH = 2000;
    inst.handlers!.onPointerDown!({ localX: 0, localY: 200 } as any);
    // drag up 20px per move → scrolls down 20 each, velocity builds
    inst.handlers!.onPointerMove!({ localX: 0, localY: 180 } as any);
    inst.handlers!.onPointerMove!({ localX: 0, localY: 160 } as any);
    inst.handlers!.onPointerMove!({ localX: 0, localY: 140 } as any);
    const atRelease = node.scrollY;
    inst.handlers!.onPointerUp!({ localX: 0, localY: 140 } as any);
    // momentum should have queued a frame
    expect(hasPending()).toBe(true);
    let t = 0; for (let i = 0; i < 300 && hasPending(); i++) { t += 16; tick(t); }
    expect(node.scrollY).toBeGreaterThan(atRelease); // flung further
    expect(node.scrollY).toBeLessThanOrEqual(1900); // clamped
  }));
});
it('pointerdown cancels an in-flight fling', () => {
  const { host, tick, hasPending } = fakeHost();
  createRoot(() => runWithContext(hostContext, host, () => {
    const inst = ScrollView({ scrollbar: false, children: Box({ style: { width: 80, height: 2000 } }) });
    const node: any = inst.layout; node.maxScrollY = 1900;
    inst.handlers!.onPointerDown!({ localX: 0, localY: 200 } as any);
    inst.handlers!.onPointerMove!({ localX: 0, localY: 160 } as any);
    inst.handlers!.onPointerMove!({ localX: 0, localY: 120 } as any);
    inst.handlers!.onPointerUp!({ localX: 0, localY: 120 } as any);
    tick(16); const mid = node.scrollY;
    inst.handlers!.onPointerDown!({ localX: 0, localY: 120 } as any); // grab → cancel fling
    expect(hasPending()).toBe(false);
    // no more frames advance it
    expect(node.scrollY).toBe(mid);
  }));
});
it('momentum:false → no fling', () => {
  const { host, hasPending } = fakeHost();
  createRoot(() => runWithContext(hostContext, host, () => {
    const inst = ScrollView({ scrollbar: false, momentum: false, children: Box({ style: { width: 80, height: 2000 } }) });
    const node: any = inst.layout; node.maxScrollY = 1900;
    inst.handlers!.onPointerDown!({ localX: 0, localY: 200 } as any);
    inst.handlers!.onPointerMove!({ localX: 0, localY: 140 } as any);
    const atRelease = node.scrollY;
    inst.handlers!.onPointerUp!({ localX: 0, localY: 140 } as any);
    expect(hasPending()).toBe(false);
    expect(node.scrollY).toBe(atRelease);
  }));
});
