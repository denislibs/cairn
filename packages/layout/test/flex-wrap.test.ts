import { describe, it, expect } from 'vitest';
import { FlexNode } from '../src/flex';
import { LayoutNode } from '../src/node';

class Fixed extends LayoutNode {
  constructor(public w: number, public h: number) {
    super();
  }
  layout() {
    this.size = { w: this.w, h: this.h };
    return this.size;
  }
}

const ctx: any = { measureText: () => ({ width: 0 }) };

it('wrap breaks children into lines and stacks them', () => {
  const items = [new Fixed(40, 10), new Fixed(40, 10), new Fixed(40, 10)]; // maxW 100 → 2 per line
  const row = new FlexNode({ direction: 'row', wrap: 'wrap', gap: 0, children: items });
  row.layout({ minW: 0, maxW: 100, minH: 0, maxH: 100 }, ctx);
  expect(items[0].offsetY).toBe(0);
  expect(items[1].offsetY).toBe(0);
  expect(items[2].offsetY).toBe(10); // second line
  expect(items[2].offsetX).toBe(0);
});

describe('flex wrap', () => {
  it('positions children correctly on first line', () => {
    const items = [new Fixed(40, 10), new Fixed(40, 10), new Fixed(40, 10)];
    const row = new FlexNode({ direction: 'row', wrap: 'wrap', gap: 0, children: items });
    row.layout({ minW: 0, maxW: 100, minH: 0, maxH: 100 }, ctx);
    expect(items[0].offsetX).toBe(0);
    expect(items[1].offsetX).toBe(40);
  });

  it('reports correct own size', () => {
    const items = [new Fixed(40, 10), new Fixed(40, 10), new Fixed(40, 10)];
    const row = new FlexNode({ direction: 'row', wrap: 'wrap', gap: 0, children: items });
    const size = row.layout({ minW: 0, maxW: 100, minH: 0, maxH: 100 }, ctx);
    // main = max line used = 80 (2 × 40), cross = 10+10 = 20
    expect(size.w).toBe(80);
    expect(size.h).toBe(20);
  });

  it('respects gap between children and gap between lines', () => {
    const items = [new Fixed(40, 10), new Fixed(40, 10), new Fixed(40, 10)];
    const row = new FlexNode({ direction: 'row', wrap: 'wrap', gap: 5, children: items });
    row.layout({ minW: 0, maxW: 100, minH: 0, maxH: 200 }, ctx);
    // Line 1: item0 at x=0, item1 at x=45 (40+5). item2 doesn't fit (45+40=85 ≤ 100, so it fits!)
    // Actually with gap: item0=40, gap=5, item1=40 → total=85 ≤ 100, item2 would be 85+5+40=130 > 100
    // So line1: [item0, item1], line2: [item2]
    expect(items[0].offsetX).toBe(0);
    expect(items[1].offsetX).toBe(45); // 40 + 5 gap
    expect(items[2].offsetY).toBe(15); // line cross (10) + gap (5)
    expect(items[2].offsetX).toBe(0);
  });

  it('does not wrap when wrap is nowrap (default)', () => {
    const items = [new Fixed(40, 10), new Fixed(40, 10), new Fixed(40, 10)];
    const row = new FlexNode({ direction: 'row', gap: 0, children: items });
    row.layout({ minW: 0, maxW: 100, minH: 0, maxH: 100 }, ctx);
    // All children on one line, all at offsetY=0
    expect(items[0].offsetY).toBe(0);
    expect(items[1].offsetY).toBe(0);
    expect(items[2].offsetY).toBe(0);
  });

  it('wraps column direction correctly', () => {
    // 3 items of height 40, maxH 100 → 2 per column, wrap adds second column
    const items = [new Fixed(10, 40), new Fixed(10, 40), new Fixed(10, 40)];
    const col = new FlexNode({ direction: 'column', wrap: 'wrap', gap: 0, children: items });
    col.layout({ minW: 0, maxW: 200, minH: 0, maxH: 100 }, ctx);
    expect(items[0].offsetX).toBe(0);
    expect(items[1].offsetX).toBe(0);
    expect(items[2].offsetX).toBe(10); // second column
    expect(items[2].offsetY).toBe(0);
  });

  it('does not wrap when main constraint is infinite', () => {
    const items = [new Fixed(40, 10), new Fixed(40, 10), new Fixed(40, 10)];
    const row = new FlexNode({ direction: 'row', wrap: 'wrap', gap: 0, children: items });
    row.layout({ minW: 0, maxW: Infinity, minH: 0, maxH: Infinity }, ctx);
    // Infinite main → nowrap path; all on one line
    expect(items[0].offsetY).toBe(0);
    expect(items[1].offsetY).toBe(0);
    expect(items[2].offsetY).toBe(0);
  });

  it('cross-aligns children within their line with alignSelf', () => {
    // line height is 20, item0 is 10 tall (alignSelf center → offsetY = 5)
    const items = [new Fixed(40, 10), new Fixed(40, 20)];
    const row = new FlexNode({ direction: 'row', wrap: 'wrap', gap: 0, children: items });
    items[0].alignSelf = 'center';
    row.layout({ minW: 0, maxW: 100, minH: 0, maxH: 100 }, ctx);
    // Both fit on one line (80 ≤ 100). Line cross = 20 (max).
    // item0: alignSelf center → offsetY = (20-10)/2 = 5
    // item1: alignSelf undefined → align 'start' → offsetY = 0
    expect(items[0].offsetY).toBe(5);
    expect(items[1].offsetY).toBe(0);
  });
});
