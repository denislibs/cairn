import { StackNode } from '@cairn/layout';
import { type Instance } from '@cairn/runtime';
import { applyLayoutChildProps, type LayoutChildProps } from './layout-child';

export interface StackProps extends LayoutChildProps {
  children?: Instance | Instance[];
}

// A bare absolute-positioning container: children are placed at their left/top
// (set via LayoutChildProps). Wrap in a Box for a background/padding.
export function Stack(props: StackProps = {}): Instance {
  const children =
    props.children == null ? [] : Array.isArray(props.children) ? props.children : [props.children];
  const layout = new StackNode({ children: children.map((c) => c.layout) });
  const instance: Instance = { layout, children, paintSelf() {} };
  applyLayoutChildProps(instance, props);
  return instance;
}
