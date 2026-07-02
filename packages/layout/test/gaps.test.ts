import { describe, it, expect } from 'vitest';
import { FlexNode } from '../src/flex';
import { LayoutNode } from '../src/node';
class Fixed extends LayoutNode { constructor(public w:number,public h:number){super();} layout(){this.size={w:this.w,h:this.h};return this.size;} }
const ctx:any={measureText:()=>({width:0})};
it('row uses columnGap between children', () => {
  const a=new Fixed(10,10), b=new Fixed(10,10);
  const row=new FlexNode({direction:'row',columnGap:7,children:[a,b]});
  row.layout({minW:0,maxW:100,minH:0,maxH:100},ctx);
  expect(b.offsetX).toBe(17);
});
it('column uses rowGap between children', () => {
  const a=new Fixed(10,10), b=new Fixed(10,10);
  const col=new FlexNode({direction:'column',rowGap:9,children:[a,b]});
  col.layout({minW:0,maxW:100,minH:0,maxH:100},ctx);
  expect(b.offsetY).toBe(19);
});
