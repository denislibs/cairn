import type { Instance, SemanticsNode } from '@cairn/runtime';
import { Box, Column, Text, applyLayoutChildProps, mergeStyles, type StyleInput, type LayoutChildProps } from '@cairn/primitives';
import { useWidgetTheme } from './theme';
import { createControl } from './control';

export interface CardProps extends LayoutChildProps {
  children?: Instance | Instance[] | string;
  padding?: number;
  elevation?: 0 | 1 | 2 | 3;
  interactive?: boolean;
  onClick?: () => void;
  style?: StyleInput;
}

// Elevation shadow definitions (rgba black at increasing opacity/spread)
const ELEVATION_SHADOWS: Record<number, string> = {
  0: 'none',
  1: 'rgba(0,0,0,0.08)',
  2: 'rgba(0,0,0,0.14)',
  3: 'rgba(0,0,0,0.20)',
};

const ELEVATION_BLUR: Record<number, number> = {
  0: 0,
  1: 4,
  2: 8,
  3: 16,
};

const ELEVATION_SPREAD: Record<number, number> = {
  0: 0,
  1: 0,
  2: 2,
  3: 4,
};

export function Card(props: CardProps = {}): Instance {
  const t = useWidgetTheme();

  const elevation = props.elevation ?? 1;
  const padding = props.padding ?? t.spacing.md;
  const interactive = !!props.interactive;

  // Resolve children: string → Text, single instance, or array
  let resolvedChildren: Instance | Instance[] | undefined;
  if (typeof props.children === 'string') {
    resolvedChildren = Text({ children: props.children });
  } else {
    resolvedChildren = props.children;
  }

  // Base card style
  const baseStyle: StyleInput = (_th) => {
    const shadow =
      elevation > 0
        ? {
            boxShadow: {
              color: ELEVATION_SHADOWS[elevation],
              blur: ELEVATION_BLUR[elevation],
              spread: ELEVATION_SPREAD[elevation],
              offsetX: 0,
              offsetY: elevation * 2,
              inset: false,
            },
          }
        : {};
    return {
      backgroundColor: t.colors.surface,
      borderRadius: t.radii.lg,
      padding: { left: padding, right: padding, top: padding, bottom: padding },
      cursor: interactive ? 'pointer' : 'default',
      ...shadow,
    };
  };

  const composedStyle = mergeStyles(baseStyle, props.style);

  // Build content container
  const childrenArray: Instance[] | undefined = resolvedChildren
    ? Array.isArray(resolvedChildren)
      ? resolvedChildren
      : [resolvedChildren]
    : undefined;

  if (interactive) {
    const activate = () => props.onClick?.();

    const { handlers, setFocusVisible } = createControl({
      onClick: props.onClick,
    });

    const semantics: SemanticsNode = {
      role: 'button',
      onActivate: activate,
      onFocus: (keyboard: boolean) => setFocusVisible(keyboard),
      onBlur: () => setFocusVisible(false),
    };

    const instance = Box({
      style: composedStyle,
      focusable: true,
      ...handlers,
      children: childrenArray
        ? childrenArray.length === 1
          ? childrenArray[0]
          : Column({ children: childrenArray })
        : undefined,
    });

    instance.semantics = semantics;
    applyLayoutChildProps(instance, props);
    instance.debugName = 'Card';
    return instance;
  }

  // Non-interactive path
  const semantics: SemanticsNode = {
    role: 'group',
  };

  const instance = Box({
    style: composedStyle,
    children: childrenArray
      ? childrenArray.length === 1
        ? childrenArray[0]
        : Column({ children: childrenArray })
      : undefined,
  });

  instance.semantics = semantics;
  applyLayoutChildProps(instance, props);
  instance.debugName = 'Card';
  return instance;
}
