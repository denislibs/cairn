import { describe, it, expect } from 'vitest';
import { ScrollNode } from '../src/scroll';
import { LayoutNode } from '../src/node';

class Fixed extends LayoutNode {
  constructor(public w: number, public h: number) { super(); }
  layout() { this.size = { w: this.w, h: this.h }; return this.size; }
}

const ctx: any = { measureText: () => ({ width: 0 }), viewport: { w: 1000, h: 800 }, rootFontSize: 16 };

describe('ScrollNode', () => {
  it('lets a tall child overflow; own size = viewport; reports contentH', () => {
    const child = new Fixed(80, 300);
    const n = new ScrollNode({ width: 100, height: 100, direction: 'vertical', child });
    const s = n.layout({ minW: 0, maxW: 1000, minH: 0, maxH: 1000 }, ctx);
    expect(s).toEqual({ w: 100, h: 100 });      // viewport
    expect(child.size.h).toBe(300);              // child kept natural height (unbounded)
    expect(n.contentH).toBe(300);
    expect(n.maxScrollY).toBe(200);              // 300 - 100
  });

  it('scrollY shifts child up, clamped', () => {
    const child = new Fixed(80, 300);
    const n = new ScrollNode({ width: 100, height: 100, child });
    n.scrollY = 30;
    n.layout({ minW: 0, maxW: 1000, minH: 0, maxH: 1000 }, ctx);
    expect(child.offsetY).toBe(-30);
    n.scrollY = 999;
    n.layout({ minW: 0, maxW: 1000, minH: 0, maxH: 1000 }, ctx);
    expect(child.offsetY).toBe(-200);            // clamped to maxScrollY
  });

  it('horizontal: child overflows on x', () => {
    const child = new Fixed(300, 50);
    const n = new ScrollNode({ width: 100, height: 60, direction: 'horizontal', child });
    n.scrollX = 40;
    n.layout({ minW: 0, maxW: 1000, minH: 0, maxH: 1000 }, ctx);
    expect(child.size.w).toBe(300);
    expect(n.maxScrollX).toBe(200);
    expect(child.offsetX).toBe(-40);
  });

  it('no child → size = viewport', () => {
    const n = new ScrollNode({ width: 100, height: 100 });
    const s = n.layout({ minW: 0, maxW: 1000, minH: 0, maxH: 1000 }, ctx);
    expect(s).toEqual({ w: 100, h: 100 });
  });
});
