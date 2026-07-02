import { type Instance } from '@cairn/runtime';
import { toEdgeInsets, type EdgeInsets } from '@cairn/layout';

// Parent-data props: meaningful inside a Flex (flex) or Stack (left/top) parent.
export interface LayoutChildProps {
  flex?: number;
  flexBasis?: number;
  flexShrink?: number;
  left?: number;
  top?: number;
  margin?: number | Partial<EdgeInsets>;
  alignSelf?: 'start' | 'center' | 'end' | 'stretch';
}

export function applyLayoutChildProps(inst: Instance, props: LayoutChildProps): void {
  if (props.flex !== undefined) inst.layout.flex = props.flex;
  if (props.flexBasis !== undefined) inst.layout.flexBasis = props.flexBasis;
  if (props.flexShrink !== undefined) inst.layout.flexShrink = props.flexShrink;
  if (props.left !== undefined) inst.layout.left = props.left;
  if (props.top !== undefined) inst.layout.top = props.top;
  if (props.margin !== undefined) inst.layout.margin = toEdgeInsets(props.margin);
  if (props.alignSelf !== undefined) inst.layout.alignSelf = props.alignSelf;
}
