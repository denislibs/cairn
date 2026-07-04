import type { Instance, SemanticsNode } from '@cairn/runtime';
import { Box, applyLayoutChildProps, mergeStyles, type StyleInput, type LayoutChildProps } from '@cairn/primitives';
import { useWidgetTheme } from './theme';

export type SkeletonVariant = 'text' | 'rect' | 'circle';

export interface SkeletonProps extends LayoutChildProps {
  width?: number | string;
  height?: number;
  radius?: number;
  variant?: SkeletonVariant;
  style?: StyleInput;
}

export function Skeleton(props: SkeletonProps = {}): Instance {
  const t = useWidgetTheme();
  const height = props.height ?? 16;
  const variant = props.variant ?? 'rect';

  const borderRadius =
    variant === 'circle'
      ? height / 2
      : variant === 'text'
      ? t.radii.sm
      : (props.radius ?? t.radii.md);

  const instance = Box({
    style: mergeStyles(
      {
        width: props.width,
        height,
        backgroundColor: t.colors.surfaceAlt,
        borderRadius,
      },
      props.style,
    ),
  });

  const sem: SemanticsNode = { role: 'none' };
  instance.semantics = sem;

  applyLayoutChildProps(instance, props);
  return instance;
}
