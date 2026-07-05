import { describe, it, expect } from 'vitest';
import type { SnapshotNode } from '../src/protocol';
import { hitTest, PickController } from '../src/pick';

function n(id: number, rect: { x: number; y: number; w: number; h: number }, zIndex = 0, children: SnapshotNode[] = []): SnapshotNode {
  return {
    id, name: 'Box', rect, size: { w: rect.w, h: rect.h }, offset: { x: rect.x, y: rect.y },
    layout: { flex: 0, zIndex, margin: { top: 0, right: 0, bottom: 0, left: 0 } },
    flags: { clip: false, transform: false, opacity: 1, focusable: false, pointerEvents: 'auto' },
    children,
  };
}

describe('hitTest', () => {
  it('returns null when the point is outside the root', () => {
    expect(hitTest(n(1, { x: 0, y: 0, w: 10, h: 10 }), 50, 50)).toBeNull();
  });
  it('returns the deepest node containing the point', () => {
    const child = n(2, { x: 2, y: 2, w: 4, h: 4 });
    const root = n(1, { x: 0, y: 0, w: 20, h: 20 }, 0, [child]);
    expect(hitTest(root, 3, 3)?.id).toBe(2);
  });
  it('returns the root when no child contains the point', () => {
    const child = n(2, { x: 2, y: 2, w: 4, h: 4 });
    const root = n(1, { x: 0, y: 0, w: 20, h: 20 }, 0, [child]);
    expect(hitTest(root, 15, 15)?.id).toBe(1);
  });
  it('prefers the higher zIndex sibling on overlap', () => {
    const low = n(2, { x: 0, y: 0, w: 10, h: 10 }, 0);
    const high = n(3, { x: 0, y: 0, w: 10, h: 10 }, 5);
    const root = n(1, { x: 0, y: 0, w: 10, h: 10 }, 0, [low, high]);
    expect(hitTest(root, 5, 5)?.id).toBe(3);
  });
});

function stubCanvas() {
  const listeners: Record<string, (e: any) => void> = {};
  return {
    addEventListener: (_t: string, h: (e: any) => void, _capture?: boolean) => { listeners[_t] = h; },
    removeEventListener: (_t: string, _h: (e: any) => void, _capture?: boolean) => { delete listeners[_t]; },
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 100, height: 100 }),
    _fire: (t: string, e: any) => listeners[t]?.(e),
  } as any;
}

describe('PickController', () => {
  it('suppresses the click only when a node is hit', () => {
    // HIT case
    const canvas = stubCanvas();
    const selected: number[] = [];
    const pc = new PickController(canvas, () => ({ w: 100, h: 100 }), {
      onHover: () => {},
      onSelect: (id) => selected.push(id),
    });
    pc.update(n(1, { x: 0, y: 0, w: 10, h: 10 }));
    pc.start();

    let pd = 0, sp = 0;
    canvas._fire('pointerdown', {
      clientX: 5, clientY: 5,
      preventDefault: () => pd++,
      stopPropagation: () => sp++,
    });
    expect(selected).toEqual([1]);
    expect(pd).toBe(1);
    expect(sp).toBe(1);

    // MISS case — use a fresh controller so start() is not guarded by active flag
    const canvas2 = stubCanvas();
    const selected2: number[] = [];
    const pc2 = new PickController(canvas2, () => ({ w: 100, h: 100 }), {
      onHover: () => {},
      onSelect: (id) => selected2.push(id),
    });
    pc2.update(n(1, { x: 0, y: 0, w: 10, h: 10 }));
    pc2.start();

    let pd2 = 0, sp2 = 0;
    canvas2._fire('pointerdown', {
      clientX: 50, clientY: 50,
      preventDefault: () => pd2++,
      stopPropagation: () => sp2++,
    });
    expect(selected2).toEqual([]);
    expect(pd2).toBe(0);
    expect(sp2).toBe(0);
  });
});
