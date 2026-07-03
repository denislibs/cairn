import { describe, it, expect } from 'vitest';
import { createRoot, createSignal } from '@cairn/reactivity';
import { setFrameRequester } from '@cairn/runtime';
import { ScrollView } from '../src/scroll-view';
import { Box } from '../src/box';

// Suppress frame scheduling noise in tests
setFrameRequester(() => {});

function make(props: any = {}) {
  return createRoot(() => {
    const inst = ScrollView({ children: Box({ style: { width: 80, height: 400 } }), ...props });
    return inst;
  });
}

describe('ScrollView', () => {
  it('wheel scrolls down, clamped to maxScrollY', () => {
    createRoot(() => {
      const seen: number[] = [];
      const inst = ScrollView({
        children: Box({ style: { width: 80, height: 400 } }),
        onScroll: (p) => seen.push(p.y),
      });
      const node: any = inst.layout;
      node.maxScrollY = 300;
      node.viewportH = 100;
      node.contentH = 400;

      inst.handlers!.onWheel!({ deltaX: 0, deltaY: 50 } as any);
      expect(node.scrollY).toBe(50);

      inst.handlers!.onWheel!({ deltaX: 0, deltaY: 999 } as any);
      expect(node.scrollY).toBe(300); // clamped
    });
  });

  it('drag updates offset', () => {
    createRoot(() => {
      const inst = ScrollView({ children: Box({ style: { width: 80, height: 400 } }) });
      const node: any = inst.layout;
      node.maxScrollY = 300;

      inst.handlers!.onPointerDown!({ localX: 0, localY: 100 } as any);
      inst.handlers!.onPointerMove!({ localX: 0, localY: 70 } as any); // moved up 30 → scroll down 30
      expect(node.scrollY).toBe(30);
    });
  });

  it('controlled reads scrollTop + fires onScroll, does not mutate internal', () => {
    createRoot(() => {
      const [top, setTop] = createSignal(0);
      const seen: number[] = [];
      const inst = ScrollView({
        children: Box({ style: { width: 80, height: 400 } }),
        scrollTop: top,
        onScroll: (p) => {
          seen.push(p.y);
          setTop(p.y);
        },
      });
      const node: any = inst.layout;
      node.maxScrollY = 300;

      inst.handlers!.onWheel!({ deltaX: 0, deltaY: 40 } as any);
      expect(seen).toEqual([40]);
      expect(top()).toBe(40);
    });
  });

  it('returns an instance with layout as ScrollNode', () => {
    const inst = make();
    expect(inst).toBeDefined();
    expect(inst.layout).toBeDefined();
    expect(inst.handlers).toBeDefined();
  });

  it('horizontal scroll with deltaX', () => {
    createRoot(() => {
      const inst = ScrollView({
        children: Box({ style: { width: 800, height: 80 } }),
        direction: 'horizontal',
      });
      const node: any = inst.layout;
      node.maxScrollX = 700;

      inst.handlers!.onWheel!({ deltaX: 50, deltaY: 0 } as any);
      expect(node.scrollX).toBe(50);

      inst.handlers!.onWheel!({ deltaX: 999, deltaY: 0 } as any);
      expect(node.scrollX).toBe(700); // clamped
    });
  });

  it('pointer up ends drag', () => {
    createRoot(() => {
      const inst = ScrollView({ children: Box({ style: { width: 80, height: 400 } }) });
      const node: any = inst.layout;
      node.maxScrollY = 300;

      inst.handlers!.onPointerDown!({ localX: 0, localY: 100 } as any);
      inst.handlers!.onPointerMove!({ localX: 0, localY: 70 } as any); // scroll 30
      expect(node.scrollY).toBe(30);

      inst.handlers!.onPointerUp!({ localX: 0, localY: 70 } as any);
      inst.handlers!.onPointerMove!({ localX: 0, localY: 50 } as any); // should not scroll further
      expect(node.scrollY).toBe(30);
    });
  });
});
