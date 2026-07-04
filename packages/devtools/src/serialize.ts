import type { Instance } from '@cairn/runtime';
import type { SnapshotNode } from './protocol';
import { idOf } from './ids';
import { inferName } from './name';

export function serialize(root: Instance): SnapshotNode {
  return build(root, 0, 0);
}

function build(inst: Instance, absX: number, absY: number): SnapshotNode {
  const l = inst.layout;
  const x = absX + l.offsetX;
  const y = absY + l.offsetY;

  const snap: SnapshotNode = {
    id: idOf(inst),
    name: inferName(inst),
    rect: { x, y, w: l.size.w, h: l.size.h },
    size: { w: l.size.w, h: l.size.h },
    offset: { x: l.offsetX, y: l.offsetY },
    layout: {
      flex: l.flex,
      zIndex: l.zIndex,
      margin: l.margin,
      left: l.left, top: l.top, right: l.right, bottom: l.bottom,
    },
    flags: {
      clip: inst.clipChildren != null,
      transform: inst.transform != null,
      opacity: inst.paintOpacity ?? 1,
      focusable: !!inst.focusable,
      pointerEvents: inst.pointerEvents ?? 'auto',
    },
    children: inst.children.map((c) => build(c, x, y)),
  };

  const sem = inst.semantics as { role?: string; label?: string } | undefined;
  if (sem && sem.role && sem.role !== 'none') {
    snap.semantics = { role: sem.role, label: sem.label };
  }
  return snap;
}
