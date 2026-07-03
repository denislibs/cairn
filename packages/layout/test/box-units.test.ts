import { describe, it, expect } from 'vitest';
import { BoxNode } from '../src/box';
const ctx: any = { measureText: () => ({ width: 0 }), viewport: { w: 1000, h: 800 }, rootFontSize: 16 };
it('width 50% resolves against maxW', () => {
  const b = new BoxNode({ width: '50%' as any });
  const s = b.layout({ minW: 0, maxW: 200, minH: 0, maxH: 1000 }, ctx);
  expect(s.w).toBe(100);
});
it('width auto → content sizing (no explicit)', () => {
  const b = new BoxNode({ width: 'auto' as any });
  const s = b.layout({ minW: 0, maxW: 200, minH: 0, maxH: 1000 }, ctx);
  expect(s.w).toBe(0); // no child, auto → min
});
it('padding 10% of maxW', () => {
  const child = new BoxNode({ width: 10, height: 10 });
  const b = new BoxNode({ padding: '10%' as any, child });
  const s = b.layout({ minW: 0, maxW: 200, minH: 0, maxH: 1000 }, ctx);
  // padding 20 each side → child at (20,20), box = 10+40=50 wide
  expect(child.offsetX).toBe(20);
  expect(s.w).toBe(50);
});
it('numeric width unchanged', () => {
  const b = new BoxNode({ width: 120 });
  const s = b.layout({ minW: 0, maxW: 200, minH: 0, maxH: 1000 }, ctx);
  expect(s.w).toBe(120);
});
it('vw width', () => {
  const b = new BoxNode({ width: '10vw' as any });
  const s = b.layout({ minW: 0, maxW: 1000, minH: 0, maxH: 1000 }, ctx);
  expect(s.w).toBe(100); // 10% of viewport 1000
});
