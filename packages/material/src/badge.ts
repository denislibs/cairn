import type { Instance } from '@cairn/runtime';
import { useTheme } from '@cairn/style';
import { Box, Text, Stack, mergeStyles, type StyleInput } from '@cairn/primitives';
import type { MaterialTheme } from './theme';
import type { MaterialColor } from './button';

export interface BadgeProps {
  /** Child instance or string to overlay the badge on top of (top-right corner). */
  children?: Instance | string;
  /** The badge content — string or number. Numbers > `max` render as `{max}+`. Ignored in dot variant. */
  badgeContent?: string | number;
  /** Material palette color key. Defaults to 'primary'. */
  color?: MaterialColor;
  /** 'standard' renders a pill with content; 'dot' renders a small dot with no text. Defaults to 'standard'. */
  variant?: 'standard' | 'dot';
  /** Maximum numeric value before truncating with '+'. Defaults to 99. */
  max?: number;
  /** Layer-2 style override applied to the root node. */
  style?: StyleInput;
}

/** Resolve display text for the pill, honouring `max`. */
function resolveDisplayText(content: string | number | undefined, max: number): string {
  if (content == null) return '';
  if (typeof content === 'number') {
    return content > max ? `${max}+` : String(content);
  }
  return String(content);
}

/** Build the pill label used for the status semantics node. */
function resolvePillLabel(content: string | number | undefined, max: number): string {
  if (content == null) return 'badge';
  if (typeof content === 'number') {
    const displayed = content > max ? `${max}+` : String(content);
    return `${displayed} notifications`;
  }
  return String(content);
}

/** Build a small 8×8 dot circle — no text. */
function buildDot(bgColor: string): Instance {
  const inst = Box({
    style: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: bgColor,
    },
  }) as any;
  inst._bgColor = bgColor;
  return inst as Instance;
}

/** Build a pill Box with centered text content. */
function buildPill(
  content: string | number | undefined,
  max: number,
  bgColor: string,
  textColor: string,
): Instance {
  const displayText = resolveDisplayText(content, max);

  const textNode = Text({
    children: displayText,
    style: {
      fontSize: 11,
      fontWeight: 600,
      color: textColor,
    },
  });

  const inst = Box({
    style: {
      backgroundColor: bgColor,
      borderRadius: 10,
      padding: { left: 4, right: 4, top: 2, bottom: 2 },
      minWidth: 20,
      height: 20,
      alignX: 'center' as const,
      alignY: 'center' as const,
    },
    children: textNode,
  }) as any;
  inst._bgColor = bgColor;
  return inst as Instance;
}

/**
 * Material Badge — wraps the headless badge pattern with Material Design palette colours.
 *
 * Prop mapping from Material → headless semantics:
 *   badgeContent → pill display text (count/string)
 *   variant 'dot' → renders an 8×8 dot (no text, role none)
 *   variant 'standard' (default) → pill with content (role status)
 *   color → palette[color].main background + contrastText foreground
 *   max → truncation threshold (default 99)
 *   children → overlay target (Stack layout, badge anchored top-right)
 */
export function Badge(props: BadgeProps): Instance {
  const t = useTheme() as unknown as MaterialTheme;

  const color = props.color ?? 'primary';
  const isDot = props.variant === 'dot';
  const max = props.max ?? 99;

  const palette = t.palette[color];
  const bgColor = palette.main;
  const textColor = palette.contrastText;

  // Build the badge indicator (dot or pill)
  const indicator: Instance = isDot ? buildDot(bgColor) : buildPill(props.badgeContent, max, bgColor, textColor);

  // Apply semantics: dot is decorative (none), pill is a live region (status)
  (indicator as any).semantics = isDot
    ? { role: 'none' }
    : { role: 'status', label: resolvePillLabel(props.badgeContent, max) };

  // Standalone mode (no child to overlay)
  if (props.children == null) {
    if (props.style) {
      // Merge style override into the indicator's existing style
      (indicator as any).style = mergeStyles((indicator as any).style, props.style);
    }
    return indicator;
  }

  // Overlay mode: Stack child + badge. Badge is pinned top-right.
  const wrappedChild: Instance =
    typeof props.children === 'string'
      ? Text({ children: props.children })
      : props.children;

  // Offset the badge to sit on the corner edge
  if (isDot) {
    (indicator as any).layout = { ...(indicator as any).layout, right: -4, top: -4 };
  } else {
    (indicator as any).layout = { ...(indicator as any).layout, right: -6, top: -6 };
  }

  const container = Stack({ children: [wrappedChild, indicator] });

  if (props.style) {
    (container as any).style = mergeStyles((container as any).style, props.style);
  }

  return container;
}
