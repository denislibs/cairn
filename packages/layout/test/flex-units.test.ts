import { describe, it, expect } from 'vitest';
import { FlexNode } from '../src/flex';
import { LayoutNode } from '../src/node';
class Fixed extends LayoutNode { constructor(public w:number,public h:number){super();} layout(){this.size={w:this.w,h:this.h};return this.size;} }
const ctx: any = { measureText: () => ({ width: 0 }), viewport: { w: 1000, h: 800 }, rootFontSize: 16 };
it('Row width 50% of maxW', () => {
  const row = new FlexNode({ direction: 'row', width: '50%' as any, children: [new Fixed(10,10)] });
  const s = row.layout({ minW: 0, maxW: 300, minH: 0, maxH: 100 }, ctx);
  expect(s.w).toBe(150);
});
it('numeric width unchanged', () => {
  const row = new FlexNode({ direction: 'row', width: 120, children: [new Fixed(10,10)] });
  const s = row.layout({ minW: 0, maxW: 300, minH: 0, maxH: 100 }, ctx);
  expect(s.w).toBe(120);
});
