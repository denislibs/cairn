import { describe, it, expect } from 'vitest';
import type { SnapshotNode } from '../src/protocol';
import { diffSnapshots } from '../src/diff';

function n(id: number, rect: { x: number; y: number; w: number; h: number }, children: SnapshotNode[] = []): SnapshotNode {
  return {
    id, name: 'Box', rect, size: { w: rect.w, h: rect.h }, offset: { x: rect.x, y: rect.y },
    layout: { flex: 0, zIndex: 0, margin: { top: 0, right: 0, bottom: 0, left: 0 } },
    flags: { clip: false, transform: false, opacity: 1, focusable: false, pointerEvents: 'auto' },
    children,
  };
}

describe('diffSnapshots', () => {
  it('reports no changes for identical trees', () => {
    const a = n(1, { x: 0, y: 0, w: 10, h: 10 });
    const b = n(1, { x: 0, y: 0, w: 10, h: 10 });
    expect(diffSnapshots(a, b)).toEqual([]);
  });

  it('reports a changed rect with the field name', () => {
    const prev = n(1, { x: 0, y: 0, w: 10, h: 10 });
    const next = n(1, { x: 0, y: 0, w: 20, h: 10 });
    const changed = diffSnapshots(prev, next);
    expect(changed).toHaveLength(1);
    expect(changed[0].id).toBe(1);
    expect(changed[0].fields).toContain('rect');
  });

  it('flags newly added nodes', () => {
    const prev = n(1, { x: 0, y: 0, w: 10, h: 10 });
    const next = n(1, { x: 0, y: 0, w: 10, h: 10 }, [n(2, { x: 1, y: 1, w: 2, h: 2 })]);
    const changed = diffSnapshots(prev, next);
    expect(changed).toEqual([{ id: 2, fields: ['added'] }]);
  });

  it('treats a null previous snapshot as everything added', () => {
    const next = n(1, { x: 0, y: 0, w: 10, h: 10 });
    expect(diffSnapshots(null, next)).toEqual([{ id: 1, fields: ['added'] }]);
  });
});
