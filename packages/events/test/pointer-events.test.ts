import { describe, it, expect } from 'vitest';
import { hitTest } from '../src/hit-test';
import type { HitNode } from '../src/event';
function n(x:number,y:number,w:number,h:number, extra: Partial<HitNode> = {}): any {
  return { layout: { offsetX:x, offsetY:y, size:{w,h} }, children: [], handlers: {}, ...extra };
}
it('pointerEvents none lets the pointer pass through to the node beneath', () => {
  const button = n(0,0,100,100, { handlers: { onClick(){} } } as any);
  const overlay = n(0,0,100,100, { pointerEvents: 'none' } as any);
  const root: any = n(0,0,100,100); root.children = [button, overlay]; // overlay painted last (on top)
  const path = hitTest(root, 10, 10);
  // overlay is skipped → target is the button, not the overlay
  expect(path[0]).toBe(button);
  expect(path.includes(overlay)).toBe(false);
});
it('normal overlay (pointerEvents auto) is the target', () => {
  const button = n(0,0,100,100);
  const overlay = n(0,0,100,100);
  const root: any = n(0,0,100,100); root.children = [button, overlay];
  const path = hitTest(root, 10, 10);
  expect(path[0]).toBe(overlay);
});
