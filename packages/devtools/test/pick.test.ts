import { describe, it, expect } from 'vitest';
import type { SnapshotNode } from '../src/protocol';
import { hitTest } from '../src/pick';

function n(id: number, rect: { x: number; y: number; w: number; h: number }, zIndex = 0, children: SnapshotNode[] = []): SnapshotNode {
  return {
    id, name: 'Box', rect, size: { w: rect.w, h: rect.h }, offset: { x: rect.x, y: rect.y },
    layout: { flex: 0, zIndex, margin: { top: 0, right: 0, bottom: 0, left: 0 } },
    flags: { clip: false, transform: false, opacity: 1, focusable: false, pointerEvents: 'auto' },
    children,
  };
}

describe('hitTest', () => {
  it('returns null when the point is outside the root', () => {
    expect(hitTest(n(1, { x: 0, y: 0, w: 10, h: 10 }), 50, 50)).toBeNull();
  });
  it('returns the deepest node containing the point', () => {
    const child = n(2, { x: 2, y: 2, w: 4, h: 4 });
    const root = n(1, { x: 0, y: 0, w: 20, h: 20 }, 0, [child]);
    expect(hitTest(root, 3, 3)?.id).toBe(2);
  });
  it('returns the root when no child contains the point', () => {
    const child = n(2, { x: 2, y: 2, w: 4, h: 4 });
    const root = n(1, { x: 0, y: 0, w: 20, h: 20 }, 0, [child]);
    expect(hitTest(root, 15, 15)?.id).toBe(1);
  });
  it('prefers the higher zIndex sibling on overlap', () => {
    const low = n(2, { x: 0, y: 0, w: 10, h: 10 }, 0);
    const high = n(3, { x: 0, y: 0, w: 10, h: 10 }, 5);
    const root = n(1, { x: 0, y: 0, w: 10, h: 10 }, 0, [low, high]);
    expect(hitTest(root, 5, 5)?.id).toBe(3);
  });
});
