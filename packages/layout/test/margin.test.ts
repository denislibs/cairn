import { describe, it, expect } from 'vitest';
import { FlexNode } from '../src/flex';
import { BoxNode } from '../src/box';
import { LayoutNode } from '../src/node';

class Fixed extends LayoutNode {
  constructor(public w: number, public h: number) { super(); }
  layout() { this.size = { w: this.w, h: this.h }; return this.size; }
}
const ctx: any = { measureText: () => ({ width: 0 }) };

describe('margin', () => {
  it('row: leading margin shifts child, margins add to used space', () => {
    const a = new Fixed(10, 10); a.margin = { top: 0, right: 5, bottom: 0, left: 5 };
    const b = new Fixed(10, 10);
    const row = new FlexNode({ direction: 'row', children: [a, b] });
    row.layout({ minW: 0, maxW: 100, minH: 0, maxH: 100 }, ctx);
    expect(a.offsetX).toBe(5);            // leading left margin
    expect(b.offsetX).toBe(5 + 10 + 5);   // after a's box (5+10+5)
  });
  it('box: child margin insets the child and grows the box', () => {
    const c = new Fixed(10, 10); c.margin = { top: 2, right: 3, bottom: 4, left: 5 };
    const box = new BoxNode({ child: c });
    const size = box.layout({ minW: 0, maxW: 100, minH: 0, maxH: 100 }, ctx);
    expect(c.offsetX).toBe(5);
    expect(c.offsetY).toBe(2);
    expect(size.w).toBe(10 + 5 + 3);
    expect(size.h).toBe(10 + 2 + 4);
  });
});
