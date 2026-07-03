import { describe, it, expect } from 'vitest';
import { GridNode } from '../src/grid';
import { LayoutNode } from '../src/node';

class Fixed extends LayoutNode {
  constructor(public w: number, public h: number) { super(); }
  layout(c: any) {
    this.size = {
      w: (isFinite(c.maxW) && c.minW === c.maxW) ? c.maxW : this.w,
      h: (isFinite(c.maxH) && c.minH === c.maxH) ? c.maxH : this.h,
    };
    return this.size;
  }
}

const ctx: any = { measureText: () => ({ width: 0 }) };

it('auto-flow row-major into a 2-col grid', () => {
  const items = [new Fixed(1, 10), new Fixed(1, 10), new Fixed(1, 10), new Fixed(1, 10)];
  const g = new GridNode({ templateColumns: '1fr 1fr', rowGap: 0, columnGap: 0, children: items });
  g.layout({ minW: 0, maxW: 200, minH: 0, maxH: 1000 }, ctx);
  expect([items[0].offsetX, items[0].offsetY]).toEqual([0, 0]);
  expect([items[1].offsetX, items[1].offsetY]).toEqual([100, 0]);
  expect([items[2].offsetX, items[2].offsetY]).toEqual([0, 10]);   // row 1 (row height = content 10)
  expect([items[3].offsetX, items[3].offsetY]).toEqual([100, 10]);
});

it('explicit gridColumnStart places into a column', () => {
  const a = new Fixed(1, 10); a.gridColumnStart = 2;
  const g = new GridNode({ templateColumns: '100px 100px', children: [a] });
  g.layout({ minW: 0, maxW: 200, minH: 0, maxH: 1000 }, ctx);
  expect(a.offsetX).toBe(100);
});

it('column span 2 → item spans two tracks + gap', () => {
  const a = new Fixed(1, 10); a.gridColumnSpan = 2;
  const g = new GridNode({ templateColumns: '100px 100px', columnGap: 10, children: [a], alignItems: 'stretch', justifyItems: 'stretch' });
  g.layout({ minW: 0, maxW: 210, minH: 0, maxH: 1000 }, ctx);
  expect(a.size.w).toBe(210); // 100 + 10 + 100
});

it('alignItems start does not stretch the item', () => {
  const a = new Fixed(30, 10);
  const g = new GridNode({ templateColumns: '1fr', alignItems: 'start', justifyItems: 'start', children: [a] });
  g.layout({ minW: 0, maxW: 200, minH: 0, maxH: 1000 }, ctx);
  expect(a.size.w).toBe(30); // not stretched to 200
  expect(a.offsetX).toBe(0);
});
