import type { Constraints, Size, LayoutContext, EdgeInsets } from './types';

export abstract class LayoutNode {
  children: LayoutNode[] = [];
  size: Size = { w: 0, h: 0 };
  offsetX = 0; // relative to parent; set by the parent during its layout()
  offsetY = 0;
  zIndex = 0; // parent-data: paint/hit order (higher paints on top); does not affect layout
  flex = 0; // parent-data: FlexNode distributes free main-axis space by this
  flexBasis?: number; // parent-data: child's main-axis starting size before grow/shrink
  flexShrink = 0; // parent-data: shrink factor when children overflow main axis (v1: simple weight split)
  left?: number; // parent-data: StackNode positions by these
  top?: number;
  right?: number;
  bottom?: number;
  overlay?: boolean; // parent-data: StackNode overlay child — fills the stack but does not drive its size
  margin: EdgeInsets = { top: 0, right: 0, bottom: 0, left: 0 }; // parent-data: margin around this node
  alignSelf?: 'start' | 'center' | 'end' | 'stretch'; // parent-data: per-child cross-axis alignment override

  // grid item placement (1-based lines; span counts)
  gridColumnStart?: number;
  gridColumnEnd?: number;
  gridColumnSpan?: number;
  gridRowStart?: number;
  gridRowEnd?: number;
  gridRowSpan?: number;
  gridArea?: string;

  // constraints down / size up: returns own size, sets children's offsets.
  abstract layout(c: Constraints, ctx: LayoutContext): Size;
}
