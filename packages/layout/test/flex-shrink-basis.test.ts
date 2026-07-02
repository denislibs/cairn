import { describe, it, expect } from 'vitest';
import { FlexNode } from '../src/flex';
import { LayoutNode } from '../src/node';

class Fixed extends LayoutNode {
  constructor(public w: number, public h: number) {
    super();
  }
  layout(c: any): any {
    this.size = { w: Math.min(this.w, c.maxW), h: Math.min(this.h, c.maxH) };
    return this.size;
  }
}

const ctx: any = { measureText: () => ({ width: 0 }) };

describe('flexBasis', () => {
  it('flexBasis sets starting main size for a non-flex child', () => {
    const a = new Fixed(999, 10);
    a.flexBasis = 30;
    const row = new FlexNode({ direction: 'row', width: 100, children: [a] });
    row.layout({ minW: 0, maxW: 100, minH: 0, maxH: 50 }, ctx);
    expect(a.size.w).toBe(30);
  });

  it('flexBasis does not trigger grow behaviour (flex===0)', () => {
    const a = new Fixed(999, 10);
    a.flexBasis = 30;
    // flex is still 0, so no space distribution beyond basis
    const row = new FlexNode({ direction: 'row', width: 100, children: [a] });
    row.layout({ minW: 0, maxW: 100, minH: 0, maxH: 50 }, ctx);
    // width should be exactly 30, not expanded to 100
    expect(a.size.w).toBe(30);
  });

  it('flexBasis works on column direction', () => {
    const a = new Fixed(10, 999);
    a.flexBasis = 40;
    const col = new FlexNode({ direction: 'column', height: 100, children: [a] });
    col.layout({ minW: 0, maxW: 50, minH: 0, maxH: 100 }, ctx);
    expect(a.size.h).toBe(40);
  });
});

describe('flexShrink', () => {
  it('flexShrink shrinks children proportionally on overflow', () => {
    const a = new Fixed(80, 10);
    a.flexShrink = 1;
    a.flexBasis = 80;
    const b = new Fixed(80, 10);
    b.flexShrink = 1;
    b.flexBasis = 80;
    // Total wanted: 160, available: 100, overflow: 60 → each shrinks by 30
    const row = new FlexNode({ direction: 'row', width: 100, children: [a, b] });
    row.layout({ minW: 0, maxW: 100, minH: 0, maxH: 50 }, ctx);
    expect(a.size.w).toBe(50); // 80 - 30
    expect(b.size.w).toBe(50); // 80 - 30
  });

  it('flexShrink distributes unequal weights proportionally', () => {
    const a = new Fixed(60, 10);
    a.flexShrink = 1;
    a.flexBasis = 60;
    const b = new Fixed(60, 10);
    b.flexShrink = 2;
    b.flexBasis = 60;
    // Total wanted: 120, available: 90, overflow: 30
    // a gets 30*(1/3)=10, b gets 30*(2/3)=20
    const row = new FlexNode({ direction: 'row', width: 90, children: [a, b] });
    row.layout({ minW: 0, maxW: 90, minH: 0, maxH: 50 }, ctx);
    expect(a.size.w).toBe(50); // 60 - 10
    expect(b.size.w).toBe(40); // 60 - 20
  });

  it('flexShrink=0 children are not shrunk (default behavior)', () => {
    const a = new Fixed(80, 10);
    a.flexBasis = 80;
    // flexShrink defaults to 0
    const b = new Fixed(80, 10);
    b.flexBasis = 80;
    const row = new FlexNode({ direction: 'row', width: 100, children: [a, b] });
    row.layout({ minW: 0, maxW: 100, minH: 0, maxH: 50 }, ctx);
    // No shrink — children keep their basis sizes
    expect(a.size.w).toBe(80);
    expect(b.size.w).toBe(80);
  });

  it('flexShrink clamps to 0 (does not produce negative size)', () => {
    const a = new Fixed(200, 10);
    a.flexShrink = 1;
    a.flexBasis = 200;
    const row = new FlexNode({ direction: 'row', width: 10, children: [a] });
    row.layout({ minW: 0, maxW: 10, minH: 0, maxH: 50 }, ctx);
    expect(a.size.w).toBeGreaterThanOrEqual(0);
  });

  it('flex>0 children are not treated as shrink candidates', () => {
    const a = new Fixed(80, 10);
    a.flex = 1; // grow child — should NOT be shrunk
    const b = new Fixed(80, 10);
    b.flexBasis = 80;
    b.flexShrink = 1;
    const row = new FlexNode({ direction: 'row', width: 100, children: [a, b] });
    row.layout({ minW: 0, maxW: 100, minH: 0, maxH: 50 }, ctx);
    // b is laid out first (non-flex phase) at basis 80, leaving 20 for a (flex grow)
    // usedMain after non-flex phase = 80, available = 100, free for flex = 20
    // a (flex=1) gets share=20; total used = 100 => no overflow => no shrink
    expect(a.size.w).toBe(20);
    expect(b.size.w).toBe(80);
  });
});
