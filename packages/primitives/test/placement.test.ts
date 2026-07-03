import { describe, it, expect } from 'vitest';
import { computePlacement, getAbsRect } from '../src/placement';
import { BoxNode } from '@cairn/layout';

describe('computePlacement', () => {
  const vp = { w: 1000, h: 800 };
  const anchor = { x: 100, y: 100, width: 50, height: 20 };
  it('bottom center', () => {
    const p = computePlacement(anchor, { width: 80, height: 40 }, vp, { side: 'bottom', align: 'center', offset: 8 });
    expect(p.side).toBe('bottom');
    expect(p.y).toBe(128);           // 100 + 20 + 8
    expect(p.x).toBe(100 + 25 - 40); // anchor center 125 − content half 40 = 85
  });
  it('top when specified', () => {
    const p = computePlacement(anchor, { width: 80, height: 40 }, vp, { side: 'top', align: 'center', offset: 8 });
    expect(p.side).toBe('top');
    expect(p.y).toBe(100 - 8 - 40);  // 52
  });
  it('flips bottom→top when it would overflow below', () => {
    const low = { x: 100, y: 780, width: 50, height: 20 }; // near bottom
    const p = computePlacement(low, { width: 80, height: 40 }, vp, { side: 'bottom', flip: true, offset: 8 });
    expect(p.side).toBe('top');
  });
  it('clamps into viewport', () => {
    const p = computePlacement({ x: 980, y: 100, width: 50, height: 20 }, { width: 80, height: 40 }, vp, { side: 'bottom', align: 'start' });
    expect(p.x).toBeLessThanOrEqual(1000 - 80);
    expect(p.x).toBeGreaterThanOrEqual(0);
  });
});

describe('getAbsRect', () => {
  function node(x: number, y: number, w: number, h: number, children: any[] = []): any {
    const layout = new BoxNode({}); layout.offsetX = x; layout.offsetY = y; layout.size = { w, h };
    return { layout, children, paintSelf(){} };
  }
  it('accumulates nested offsets', () => {
    const target = node(5, 5, 10, 10);
    const root = node(0, 0, 100, 100, [ node(20, 30, 50, 50, [ target ]) ]);
    const r = getAbsRect(target, root);
    expect(r).toEqual({ x: 25, y: 35, width: 10, height: 10 }); // 0+20+5, 0+30+5
  });
  it('returns null when not found', () => {
    expect(getAbsRect(node(0,0,1,1), node(0,0,1,1))).toBe(null);
  });
});
