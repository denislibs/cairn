import { describe, it, expect } from 'vitest';
import { GridNode } from '../src/grid';
import { LayoutNode } from '../src/node';

class Fixed extends LayoutNode {
  constructor(public w: number, public h: number) { super(); }
  layout(c: any): any {
    this.size = {
      w: (isFinite(c.maxW) && c.minW === c.maxW) ? c.maxW : this.w,
      h: (isFinite(c.maxH) && c.minH === c.maxH) ? c.maxH : this.h,
    };
    return this.size;
  }
}

const ctx: any = { measureText: () => ({ width: 0 }) };

it('places items by named area', () => {
  const header = new Fixed(1, 10); header.gridArea = 'h';
  const side = new Fixed(1, 10); side.gridArea = 's';
  const main = new Fixed(1, 10); main.gridArea = 'm';
  const g = new GridNode({
    templateColumns: '100px 100px',
    templateAreas: [['h', 'h'], ['s', 'm']],
    columnGap: 0,
    rowGap: 0,
    children: [header, side, main],
  });
  g.layout({ minW: 0, maxW: 200, minH: 0, maxH: 1000 }, ctx);
  expect(header.offsetX).toBe(0);
  expect(header.size.w).toBe(200); // spans both columns (stretch default)
  expect(side.offsetX).toBe(0);
  expect(side.offsetY).toBe(10);
  expect(main.offsetX).toBe(100);
  expect(main.offsetY).toBe(10);
});
