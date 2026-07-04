import type { Instance, SemanticsNode } from '@cairn/runtime';
import { Box, Text, Image, applyLayoutChildProps, mergeStyles, type StyleInput, type LayoutChildProps } from '@cairn/primitives';
import { useWidgetTheme } from './theme';

export interface AvatarProps extends LayoutChildProps {
  src?: string;
  alt?: string;
  initials?: string;
  size?: number;
  shape?: 'circle' | 'square';
  style?: StyleInput;
}

export function Avatar(props: AvatarProps = {}): Instance {
  const t = useWidgetTheme();
  const size = props.size ?? 40;
  const shape = props.shape ?? 'circle';
  const borderRadius = shape === 'circle' ? size / 2 : t.radii.md;
  const label = props.alt ?? props.initials;

  let content: Instance;

  if (props.src) {
    // Image fills the avatar box
    content = Image({
      src: props.src,
      width: size,
      height: size,
      objectFit: 'cover',
    });

    const container = Box({
      style: mergeStyles(
        {
          width: size,
          height: size,
          borderRadius,
          backgroundColor: t.colors.muted ?? t.colors.surfaceAlt,
          overflow: 'hidden',
          alignX: 'center',
          alignY: 'center',
        },
        props.style,
      ),
      children: content,
    });

    const sem: SemanticsNode = { role: 'image', label };
    container.semantics = sem;
    applyLayoutChildProps(container, props);
    return container;
  }

  // Initials path
  const initialsText = props.initials
    ? Text({
        children: props.initials,
        style: {
          fontSize: Math.round(size * 0.38),
          fontWeight: t.fontWeights.medium,
          color: t.colors.onPrimary ?? '#ffffff',
        },
      })
    : undefined;

  const container = Box({
    style: mergeStyles(
      {
        width: size,
        height: size,
        borderRadius,
        backgroundColor: t.colors.primary,
        alignX: 'center',
        alignY: 'center',
      },
      props.style,
    ),
    children: initialsText,
  });

  const sem: SemanticsNode = { role: 'image', label };
  container.semantics = sem;
  applyLayoutChildProps(container, props);
  return container;
}
