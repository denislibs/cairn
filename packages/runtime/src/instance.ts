import type { Renderer } from '@cairn/host';
import type { LayoutNode } from '@cairn/layout';
import type { EventHandlers } from '@cairn/events';

export interface Instance {
  layout: LayoutNode;
  paintSelf(r: Renderer): void;
  children: Instance[];
  handlers?: EventHandlers;
  focusable?: boolean;
}

// Walk the instance tree, translating into each node's local coordinate space.
export function paint(inst: Instance, r: Renderer): void {
  r.save();
  r.translate(inst.layout.offsetX, inst.layout.offsetY);
  inst.paintSelf(r);
  for (const child of inst.children) paint(child, r);
  r.restore();
}
