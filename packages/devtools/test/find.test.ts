import { describe, it, expect } from 'vitest';
import type { SnapshotNode } from '../src/protocol';
import { findNode } from '../src/find';

function n(id: number, children: SnapshotNode[] = []): SnapshotNode {
  return {
    id, name: 'Box', rect: { x: 0, y: 0, w: 1, h: 1 }, size: { w: 1, h: 1 }, offset: { x: 0, y: 0 },
    layout: { flex: 0, zIndex: 0, margin: { top: 0, right: 0, bottom: 0, left: 0 } },
    flags: { clip: false, transform: false, opacity: 1, focusable: false, pointerEvents: 'auto' },
    children,
  };
}

describe('findNode', () => {
  const tree = n(1, [n(2), n(3, [n(4)])]);
  it('finds a nested node by id', () => expect(findNode(tree, 4)?.id).toBe(4));
  it('finds the root', () => expect(findNode(tree, 1)?.id).toBe(1));
  it('returns null for a missing id', () => expect(findNode(tree, 99)).toBeNull());
});
