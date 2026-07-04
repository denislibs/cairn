import type { Instance, SemanticsNode } from '@cairn/runtime';
import { Box, Text, Stack, applyLayoutChildProps, mergeStyles, type StyleInput, type LayoutChildProps } from '@cairn/primitives';
import { useWidgetTheme } from './theme';

// Helper: inject alpha into a hex color string (same approach as button.ts).
function withAlpha(hex: string, alpha: number): string {
  if (hex.startsWith('rgba(') || hex.startsWith('rgb(')) {
    const inner = hex.replace(/^rgba?\(/, '').replace(/\)$/, '');
    const parts = inner.split(',').map((p) => p.trim());
    return `rgba(${parts[0]},${parts[1]},${parts[2]},${alpha})`;
  }
  let h = hex.replace('#', '');
  if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);
  if (isNaN(r) || isNaN(g) || isNaN(b)) return hex;
  return `rgba(${r},${g},${b},${alpha})`;
}

export interface BadgeProps extends LayoutChildProps {
  /**
   * The content to display inside the badge. Numbers > `max` render as `{max}+`.
   * Ignored when `dot` is true.
   */
  content?: string | number;
  /**
   * Base color key from the theme (e.g. 'primary', 'danger', 'success'). Defaults to 'primary'.
   */
  color?: string;
  /**
   * 'solid' uses an opaque background; 'soft' uses the color at 12% opacity. Defaults to 'solid'.
   */
  variant?: 'solid' | 'soft';
  /**
   * When true, renders a small dot circle with no text. Role is 'none' (decorative).
   */
  dot?: boolean;
  /**
   * Maximum numeric value before truncating with '+'. Defaults to 99.
   */
  max?: number;
  /**
   * Layer-2 style override applied via mergeStyles.
   */
  style?: StyleInput;
  /**
   * When provided, the badge overlays the child at the top-right corner (Stack layout).
   * Accepts an Instance or a string (string is wrapped in Text).
   */
  children?: Instance | string;
}

export function Badge(props: BadgeProps): Instance {
  const t = useWidgetTheme();

  const colorKey = props.color ?? 'primary';
  const variant = props.variant ?? 'solid';
  const isDot = !!props.dot;
  const max = props.max ?? 99;

  // Resolve background color based on variant
  const baseColor = t.colors[colorKey] ?? t.colors.primary;
  const onColor = t.colors['on' + colorKey.charAt(0).toUpperCase() + colorKey.slice(1)] ?? '#ffffff';

  const bgColor = variant === 'solid' ? baseColor : withAlpha(baseColor, 0.12);
  const textColor = variant === 'solid' ? onColor : baseColor;

  // Build the pill or dot instance
  const pill = isDot ? buildDot(bgColor) : buildPill(props.content, max, bgColor, textColor, t, props.style);

  // Set semantics on the pill
  const sem: SemanticsNode = isDot
    ? { role: 'none' }
    : { role: 'status', label: resolvePillLabel(props.content, max) };
  pill.semantics = sem;

  // If no wrapped children: standalone badge — apply layout child props & style directly
  if (props.children == null) {
    applyLayoutChildProps(pill, props);
    return pill;
  }

  // Overlay mode: wrap child + badge in a Stack
  const wrappedChild: Instance =
    typeof props.children === 'string'
      ? Text({ children: props.children })
      : props.children;

  // Position the badge at top-right of the Stack
  if (isDot) {
    pill.layout.right = -4;
    pill.layout.top = -4;
  } else {
    pill.layout.right = -6;
    pill.layout.top = -6;
  }

  const container = Stack({ children: [wrappedChild, pill] });
  applyLayoutChildProps(container, props);
  return container;
}

/** Build a small dot circle — no text. */
function buildDot(bgColor: string): Instance {
  return Box({
    style: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: bgColor,
    },
  });
}

/** Resolve the display text for a pill badge. */
function resolveDisplayText(content: string | number | undefined, max: number): string {
  if (content == null) return '';
  if (typeof content === 'number') {
    return content > max ? `${max}+` : String(content);
  }
  return String(content);
}

/** Build the human-readable label for the semantics node. */
function resolvePillLabel(content: string | number | undefined, max: number): string {
  if (content == null) return 'badge';
  if (typeof content === 'number') {
    const displayed = content > max ? `${max}+` : String(content);
    return `${displayed} notifications`;
  }
  return String(content);
}

/** Build a pill badge box with optional text. */
function buildPill(
  content: string | number | undefined,
  max: number,
  bgColor: string,
  textColor: string,
  t: ReturnType<typeof useWidgetTheme>,
  style?: StyleInput,
): Instance {
  const displayText = resolveDisplayText(content, max);

  const pillStyle: StyleInput = mergeStyles(
    {
      backgroundColor: bgColor,
      borderRadius: t.radii.pill,
      padding: { left: t.spacing.xs, right: t.spacing.xs, top: 2, bottom: 2 },
      minWidth: 20,
      height: 20,
      alignX: 'center' as const,
      alignY: 'center' as const,
    },
    style,
  );

  const textNode = Text({
    children: displayText,
    style: {
      fontSize: t.fontSizes.xs,
      fontWeight: t.fontWeights.medium,
      color: textColor,
    },
  });

  // A pill needs a painted background + padding + minWidth, which only Box
  // honours (FlexNode/Row ignores backgroundColor/padding/minWidth/borderRadius).
  return Box({
    style: pillStyle,
    children: textNode,
  });
}
