import { describe, it, expect } from 'vitest';
import { FlexNode } from '../src/flex';
import { LayoutNode } from '../src/node';

class Fixed extends LayoutNode {
  constructor(public w: number, public h: number) { super(); }
  layout() { this.size = { w: this.w, h: this.h }; return this.size; }
}

const ctx: any = { measureText: () => ({ width: 0 }) };

it('alignSelf overrides container align on cross axis', () => {
  const a = new Fixed(10, 10);
  a.alignSelf = 'end';
  const row = new FlexNode({ direction: 'row', align: 'start', height: 50, children: [a] });
  row.layout({ minW: 0, maxW: 100, minH: 0, maxH: 50 }, ctx);
  expect(a.offsetY).toBe(40); // 50 - 10
});

describe('alignSelf', () => {
  it('defaults to container align when not set', () => {
    const a = new Fixed(10, 10);
    const row = new FlexNode({ direction: 'row', align: 'center', height: 50, children: [a] });
    row.layout({ minW: 0, maxW: 100, minH: 0, maxH: 50 }, ctx);
    expect(a.offsetY).toBe(20); // (50 - 10) / 2
  });

  it('alignSelf center overrides container align start', () => {
    const a = new Fixed(10, 10);
    a.alignSelf = 'center';
    const row = new FlexNode({ direction: 'row', align: 'start', height: 50, children: [a] });
    row.layout({ minW: 0, maxW: 100, minH: 0, maxH: 50 }, ctx);
    expect(a.offsetY).toBe(20); // (50 - 10) / 2
  });

  it('alignSelf start overrides container align end', () => {
    const a = new Fixed(10, 10);
    a.alignSelf = 'start';
    const row = new FlexNode({ direction: 'row', align: 'end', height: 50, children: [a] });
    row.layout({ minW: 0, maxW: 100, minH: 0, maxH: 50 }, ctx);
    expect(a.offsetY).toBe(0);
  });

  it('alignSelf stretch falls through to start (v1 deferred)', () => {
    const a = new Fixed(10, 10);
    a.alignSelf = 'stretch';
    const row = new FlexNode({ direction: 'row', align: 'end', height: 50, children: [a] });
    row.layout({ minW: 0, maxW: 100, minH: 0, maxH: 50 }, ctx);
    // stretch on individual child is deferred in v1 — behaves like start
    expect(a.offsetY).toBe(0);
  });

  it('alignSelf works on column direction', () => {
    const a = new Fixed(10, 10);
    a.alignSelf = 'end';
    const col = new FlexNode({ direction: 'column', align: 'start', width: 50, children: [a] });
    col.layout({ minW: 0, maxW: 50, minH: 0, maxH: 100 }, ctx);
    expect(a.offsetX).toBe(40); // 50 - 10
  });

  it('per-child alignSelf: different children get different cross alignment', () => {
    const a = new Fixed(10, 10);
    const b = new Fixed(10, 10);
    a.alignSelf = 'start';
    b.alignSelf = 'end';
    const row = new FlexNode({ direction: 'row', align: 'center', height: 50, children: [a, b] });
    row.layout({ minW: 0, maxW: 200, minH: 0, maxH: 50 }, ctx);
    expect(a.offsetY).toBe(0);  // start override
    expect(b.offsetY).toBe(40); // end override (50 - 10)
  });
});
