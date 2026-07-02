import type { Renderer } from '@cairn/host';
import type { LayoutNode } from '@cairn/layout';
import type { EventHandlers } from '@cairn/events';

export interface Instance {
  layout: LayoutNode;
  paintSelf(r: Renderer): void;
  children: Instance[];
  handlers?: EventHandlers;
  focusable?: boolean;
  paintOpacity?: number;
}

// Walk the instance tree, translating into each node's local coordinate space.
export function paint(inst: Instance, r: Renderer, parentAlpha = 1): void {
  r.save();
  r.translate(inst.layout.offsetX, inst.layout.offsetY);
  const o = inst.paintOpacity;
  const alpha = o !== undefined && o < 1 ? parentAlpha * o : parentAlpha;
  if (alpha !== parentAlpha) r.setGlobalAlpha(alpha);
  inst.paintSelf(r);
  for (const child of inst.children) paint(child, r, alpha);
  r.restore();
}
