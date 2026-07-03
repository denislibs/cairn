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

it('3x 1fr splits width equally', () => {
  const items = [new Fixed(10, 10), new Fixed(10, 10), new Fixed(10, 10)];
  const g = new GridNode({ templateColumns: '1fr 1fr 1fr', children: items });
  g.layout({ minW: 0, maxW: 300, minH: 0, maxH: 1000 }, ctx);
  expect(items[0].offsetX).toBe(0);
  expect(items[1].offsetX).toBe(100);
  expect(items[2].offsetX).toBe(200);
});

it('px + fr mix', () => {
  const items = [new Fixed(10, 10), new Fixed(10, 10)];
  const g = new GridNode({ templateColumns: '100px 1fr', children: items });
  g.layout({ minW: 0, maxW: 300, minH: 0, maxH: 1000 }, ctx);
  expect(items[1].offsetX).toBe(100);
  // second item stretched to remaining 200 (alignItems default stretch)
  expect(items[1].size.w).toBe(200);
});

it('columnGap offsets tracks', () => {
  const items = [new Fixed(10, 10), new Fixed(10, 10), new Fixed(10, 10)];
  const g = new GridNode({ templateColumns: 'repeat(3, 1fr)', columnGap: 10, children: items });
  g.layout({ minW: 0, maxW: 320, minH: 0, maxH: 1000 }, ctx); // (320-20)/3=100 each
  expect(items[1].offsetX).toBe(110);
  expect(items[2].offsetX).toBe(220);
});
