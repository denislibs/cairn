import { describe, it, expect } from 'vitest';
import type { SnapshotNode } from '../src/protocol';
import { computeDelta, applyDelta } from '../src/delta';

function n(id: number, w: number, children: SnapshotNode[] = []): SnapshotNode {
  return {
    id, name: 'Box', rect: { x: 0, y: 0, w, h: 1 }, size: { w, h: 1 }, offset: { x: 0, y: 0 },
    layout: { flex: 0, zIndex: 0, margin: { top: 0, right: 0, bottom: 0, left: 0 } },
    flags: { clip: false, transform: false, opacity: 1, focusable: false, pointerEvents: 'auto' },
    children,
  };
}

describe('delta', () => {
  it('applyDelta(prev, computeDelta(prev,next)) reconstructs next', () => {
    const prev = n(1, 10, [n(2, 5), n(3, 5, [n(4, 2)])]);
    const next = n(1, 10, [n(2, 99), n(5, 7)]); // 2 changed (w), 3+4 removed, 5 added
    const rebuilt = applyDelta(prev, computeDelta(prev, next));
    expect(rebuilt).toEqual(next);
  });

  it('handles no changes', () => {
    const t = n(1, 10, [n(2, 5)]);
    expect(applyDelta(t, computeDelta(t, structuredClone(t)))).toEqual(t);
  });

  it('handles a pure attribute change on the root', () => {
    const prev = n(1, 10);
    const next = n(1, 20);
    expect(applyDelta(prev, computeDelta(prev, next))).toEqual(next);
  });
});
