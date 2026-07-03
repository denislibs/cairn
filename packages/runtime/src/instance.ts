import type { Renderer, Radii } from '@cairn/host';
import type { LayoutNode } from '@cairn/layout';
import type { EventHandlers } from '@cairn/events';

export interface Instance {
  layout: LayoutNode;
  paintSelf(r: Renderer): void;
  children: Instance[];
  handlers?: EventHandlers;
  focusable?: boolean;
  paintOpacity?: number;
  clipChildren?: Radii | null;
}

// Walk the instance tree, translating into each node's local coordinate space.
export function paint(inst: Instance, r: Renderer, parentAlpha = 1): void {
  r.save();
  r.translate(inst.layout.offsetX, inst.layout.offsetY);
  const o = inst.paintOpacity;
  const alpha = o !== undefined && o < 1 ? parentAlpha * o : parentAlpha;
  if (alpha !== parentAlpha) r.setGlobalAlpha(alpha);
  inst.paintSelf(r);
  if (inst.clipChildren !== undefined && inst.clipChildren !== null) {
    r.clipRoundRect({ x: 0, y: 0, width: inst.layout.size.w, height: inst.layout.size.h }, inst.clipChildren);
  }
  const ordered = orderByZ(inst.children);
  for (const child of ordered) paint(child, r, alpha);
  r.restore();
}

function orderByZ(children: Instance[]): Instance[] {
  if (!children.some((c) => c.layout.zIndex)) return children; // fast path: all zero
  return children
    .map((c, i) => ({ c, i }))
    .sort((a, b) => a.c.layout.zIndex - b.c.layout.zIndex || a.i - b.i)
    .map((x) => x.c);
}
