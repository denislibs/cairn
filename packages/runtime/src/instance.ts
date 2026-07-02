import type { Renderer } from '@cairn/host';
import type { LayoutNode } from '@cairn/layout';

export interface Instance {
  layout: LayoutNode;
  paintSelf(r: Renderer): void;
  children: Instance[];
}

// Walk the instance tree, translating into each node's local coordinate space.
export function paint(inst: Instance, r: Renderer): void {
  r.save();
  r.translate(inst.layout.offsetX, inst.layout.offsetY);
  inst.paintSelf(r);
  for (const child of inst.children) paint(child, r);
  r.restore();
}
