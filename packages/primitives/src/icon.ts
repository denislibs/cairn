import type { Instance } from '@cairn/runtime';
import { Path } from './svg';
import type { LayoutChildProps } from './layout-child';

export interface IconProps extends LayoutChildProps {
  path: string;
  size?: number;
  color?: string;
}

export function Icon(props: IconProps): Instance {
  const size = props.size ?? 24;
  return Path({
    d: props.path,
    fill: props.color ?? '#000',
    width: size,
    height: size,
    viewBox: [0, 0, 24, 24],
    flex: props.flex,
    flexBasis: props.flexBasis,
    flexShrink: props.flexShrink,
    left: props.left,
    top: props.top,
    right: props.right,
    bottom: props.bottom,
    inset: props.inset,
    margin: props.margin,
    alignSelf: props.alignSelf,
    zIndex: props.zIndex,
  });
}
