import { type Instance } from '@cairn/runtime';
import { toEdgeInsets, type EdgeInsets, type LayoutNode } from '@cairn/layout';
import { type BaseStyle } from '@cairn/style';

// Parent-data props: meaningful inside a Flex (flex) or Stack (left/top/right/bottom) parent.
export interface LayoutChildProps {
  flex?: number;
  flexBasis?: number;
  flexShrink?: number;
  left?: number;
  top?: number;
  right?: number;
  bottom?: number;
  inset?: number;
  margin?: number | Partial<EdgeInsets>;
  alignSelf?: 'start' | 'center' | 'end' | 'stretch';
  zIndex?: number;
}

export function applyLayoutChildProps(inst: Instance, props: LayoutChildProps): void {
  if (props.flex !== undefined) inst.layout.flex = props.flex;
  if (props.flexBasis !== undefined) inst.layout.flexBasis = props.flexBasis;
  if (props.flexShrink !== undefined) inst.layout.flexShrink = props.flexShrink;
  if (props.inset !== undefined) {
    inst.layout.left = props.left ?? props.inset;
    inst.layout.top = props.top ?? props.inset;
    inst.layout.right = props.right ?? props.inset;
    inst.layout.bottom = props.bottom ?? props.inset;
  } else {
    if (props.left !== undefined) inst.layout.left = props.left;
    if (props.top !== undefined) inst.layout.top = props.top;
    if (props.right !== undefined) inst.layout.right = props.right;
    if (props.bottom !== undefined) inst.layout.bottom = props.bottom;
  }
  if (props.margin !== undefined) inst.layout.margin = toEdgeInsets(props.margin);
  if (props.alignSelf !== undefined) inst.layout.alignSelf = props.alignSelf;
  if (props.zIndex !== undefined) inst.layout.zIndex = props.zIndex;
}

// Apply parent-data fields sourced from a resolved style onto a layout node, so
// these compose via `style` too (not only top-level child props). Guarded so a
// style that omits a field never clobbers a value set via applyLayoutChildProps.
export function applyLayoutStyle(node: LayoutNode, s: BaseStyle): void {
  if (s.flexBasis !== undefined) node.flexBasis = s.flexBasis;
  if (s.flexShrink !== undefined) node.flexShrink = s.flexShrink;
  if (s.inset !== undefined) {
    node.left = s.left ?? s.inset;
    node.top = s.top ?? s.inset;
    node.right = s.right ?? s.inset;
    node.bottom = s.bottom ?? s.inset;
  } else {
    if (s.left !== undefined) node.left = s.left;
    if (s.top !== undefined) node.top = s.top;
    if (s.right !== undefined) node.right = s.right;
    if (s.bottom !== undefined) node.bottom = s.bottom;
  }
  if (s.margin !== undefined) node.margin = toEdgeInsets(s.margin);
  if (s.alignSelf !== undefined) node.alignSelf = s.alignSelf;
  if (s.zIndex !== undefined) node.zIndex = s.zIndex;
}
