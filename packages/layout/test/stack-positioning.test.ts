import { describe, it, expect } from 'vitest';
import { StackNode } from '../src/stack';
import { LayoutNode } from '../src/node';
import type { Constraints, Size, LayoutContext } from '../src/types';

class Fixed extends LayoutNode {
  constructor(public w: number, public h: number) { super(); }
  layout(c: Constraints, _ctx: LayoutContext): Size {
    const fw = isFinite(c.maxW) && c.minW === c.maxW ? c.maxW : this.w;
    const fh = isFinite(c.maxH) && c.minH === c.maxH ? c.maxH : this.h;
    this.size = { w: fw, h: fh };
    return this.size;
  }
}

const ctx: any = { measureText: () => ({ width: 0 }) };

describe('Stack right/bottom positioning', () => {
  it('right positions child from the right edge', () => {
    const a = new Fixed(20, 10);
    a.right = 5;
    const st = new StackNode({ children: [a] });
    st.layout({ minW: 0, maxW: 100, minH: 0, maxH: 100 }, ctx);
    expect(a.offsetX).toBe(75); // 100 - 5 - 20
  });

  it('bottom positions child from the bottom edge', () => {
    const a = new Fixed(20, 10);
    a.bottom = 8;
    const st = new StackNode({ children: [a] });
    st.layout({ minW: 0, maxW: 100, minH: 0, maxH: 100 }, ctx);
    expect(a.offsetY).toBe(82); // 100 - 8 - 10
  });

  it('left+right define child width (tight constraint)', () => {
    const a = new Fixed(999, 10);
    a.left = 10;
    a.right = 10;
    const st = new StackNode({ children: [a] });
    st.layout({ minW: 0, maxW: 100, minH: 0, maxH: 100 }, ctx);
    expect(a.size.w).toBe(80); // 100 - 10 - 10
    expect(a.offsetX).toBe(10);
  });

  it('top+bottom define child height (tight constraint)', () => {
    const a = new Fixed(20, 999);
    a.top = 5;
    a.bottom = 15;
    const st = new StackNode({ children: [a] });
    st.layout({ minW: 0, maxW: 100, minH: 0, maxH: 100 }, ctx);
    expect(a.size.h).toBe(80); // 100 - 5 - 15
    expect(a.offsetY).toBe(5);
  });

  it('left only still works (existing behaviour)', () => {
    const a = new Fixed(20, 10);
    a.left = 30;
    const st = new StackNode({ children: [a] });
    st.layout({ minW: 0, maxW: 100, minH: 0, maxH: 100 }, ctx);
    expect(a.offsetX).toBe(30);
  });

  it('top only still works (existing behaviour)', () => {
    const a = new Fixed(20, 10);
    a.top = 40;
    const st = new StackNode({ children: [a] });
    st.layout({ minW: 0, maxW: 100, minH: 0, maxH: 100 }, ctx);
    expect(a.offsetY).toBe(40);
  });

  it('no position props defaults to 0,0', () => {
    const a = new Fixed(20, 10);
    const st = new StackNode({ children: [a] });
    st.layout({ minW: 0, maxW: 100, minH: 0, maxH: 100 }, ctx);
    expect(a.offsetX).toBe(0);
    expect(a.offsetY).toBe(0);
  });

  it('left wins over right when both set', () => {
    // left+right → tight width, x = left
    const a = new Fixed(999, 10);
    a.left = 20;
    a.right = 10;
    const st = new StackNode({ children: [a] });
    st.layout({ minW: 0, maxW: 100, minH: 0, maxH: 100 }, ctx);
    expect(a.offsetX).toBe(20);
    expect(a.size.w).toBe(70); // 100 - 20 - 10
  });
});
