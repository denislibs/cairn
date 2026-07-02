import { type Instance } from '@cairn/runtime';
import { toEdgeInsets, type EdgeInsets } from '@cairn/layout';

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
