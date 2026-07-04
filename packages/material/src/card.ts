import type { Instance } from '@cairn/runtime';
import { useTheme } from '@cairn/style';
import { Box, Column, Row, Text, Stack, mergeStyles, type StyleInput } from '@cairn/primitives';
import { Card as HeadlessCard, type CardProps as HeadlessCardProps } from '@cairn/widgets';
import { createRipple } from './ripple';
import type { MaterialTheme } from './theme';

export type CardVariant = 'elevation' | 'outlined';

export interface CardProps {
  children?: Instance | Instance[];
  elevation?: number;
  variant?: CardVariant;
  interactive?: boolean;
  onClick?: () => void;
  style?: StyleInput;
}

export interface CardContentProps {
  children?: Instance | Instance[];
}

export interface CardActionsProps {
  children?: Instance | Instance[];
}

// Build a single Instance from an array using Column, or return the sole item.
function childInstance(children: Instance | Instance[] | undefined): Instance | undefined {
  if (!children) return undefined;
  if (Array.isArray(children)) {
    if (children.length === 0) return undefined;
    if (children.length === 1) return children[0];
    return Column({ children });
  }
  return children;
}

export function Card(props: CardProps = {}): Instance {
  const t = useTheme() as unknown as MaterialTheme;
  const variant = props.variant ?? 'elevation';
  const elevation = props.elevation ?? 1;
  const interactive = !!props.interactive;

  // --- Material surface style ---
  const surfaceBase: Record<string, unknown> = {
    backgroundColor: t.palette.background.paper,
    borderRadius: t.shape.borderRadius,
    overflow: 'hidden' as const,
    cursor: interactive ? 'pointer' : 'default',
  };

  if (variant === 'outlined') {
    surfaceBase.border = { width: 1, color: t.palette.divider };
  } else {
    // elevation variant: theme elevation shadow array (clamped 0–24)
    surfaceBase.boxShadow = t.elevation[Math.max(0, Math.min(24, elevation))];
  }

  const composedStyle = mergeStyles([surfaceBase as any] as StyleInput, props.style);

  // --- Ripple (interactive only) ---
  const ripple = interactive
    ? createRipple({ color: 'rgba(0,0,0,1)', radius: t.shape.borderRadius })
    : null;

  // --- Build children for headless Card ---
  // The headless Card accepts Instance | Instance[] | string as children.
  // For interactive cards with a ripple, we embed the ripple alongside content.
  const contentChild = childInstance(props.children);

  const visualChild: Instance | undefined = interactive && ripple
    ? Stack({ children: contentChild ? [contentChild, ripple.instance] : [ripple.instance] })
    : contentChild;

  // --- Delegate to headless Card — all behavior (semantics, keyboard, focus) ---
  const headlessProps: HeadlessCardProps = {
    interactive,
    onClick: props.onClick,
    style: composedStyle,
    children: visualChild,
  };

  const inst = HeadlessCard(headlessProps);

  // Patch onPointerDown to trigger the ripple without re-implementing any behavior.
  // The headless Card already provides onPointerDown via createControl on the inner Box;
  // the instance.handlers object is that Box's handlers, spread through Box(props).
  if (interactive && ripple && inst.handlers) {
    const originalDown = inst.handlers.onPointerDown;
    inst.handlers.onPointerDown = (e) => {
      ripple.trigger(e.localX ?? 0, e.localY ?? 0);
      originalDown?.(e);
    };
  }

  return inst;
}

// ─── Card.Content — padded Column slot ───────────────────────────────────────

Card.Content = function CardContent(props: CardContentProps): Instance {
  const { children } = props;
  const kids = children
    ? Array.isArray(children)
      ? children
      : [children]
    : [];

  // Padding lives on a Box (FlexNode ignores padding); the inner Column hugs its
  // content (mainAxisSize:'min') so it doesn't fill the available height.
  return Box({
    style: { padding: { left: 16, right: 16, top: 16, bottom: 16 } },
    children: Column({ mainAxisSize: 'min', children: kids }),
  });
};

// ─── Card.Actions — padded Row slot ──────────────────────────────────────────

Card.Actions = function CardActions(props: CardActionsProps): Instance {
  const { children } = props;
  const kids = children
    ? Array.isArray(children)
      ? children
      : [children]
    : [];

  return Box({
    style: { padding: { left: 8, right: 8, top: 8, bottom: 8 } },
    children: Row({ mainAxisSize: 'min', style: { gap: 8, alignX: 'end' }, children: kids }),
  });
};
