import type { Constraints, Size, LayoutContext, EdgeInsets } from './types';

export abstract class LayoutNode {
  children: LayoutNode[] = [];
  size: Size = { w: 0, h: 0 };
  offsetX = 0; // relative to parent; set by the parent during its layout()
  offsetY = 0;
  flex = 0; // parent-data: FlexNode distributes free main-axis space by this
  left?: number; // parent-data: StackNode positions by these
  top?: number;
  margin: EdgeInsets = { top: 0, right: 0, bottom: 0, left: 0 }; // parent-data: margin around this node

  // constraints down / size up: returns own size, sets children's offsets.
  abstract layout(c: Constraints, ctx: LayoutContext): Size;
}
