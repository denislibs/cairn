import type { Instance, SemanticsNode } from '@cairn/runtime';
import { useOverlays, hostContext } from '@cairn/runtime';
import { createSignal, createEffect, useContext } from '@cairn/reactivity';
import { Portal, Box, Stack, Text, computePlacement, getAbsRect, mergeStyles, type StyleInput, type Side } from '@cairn/primitives';
import { useWidgetTheme } from './theme';

function safeViewport(): { w: number; h: number } {
  try {
    const host = useContext(hostContext);
    if (host) return { w: host.metrics.width, h: host.metrics.height };
  } catch {
    // not mounted
  }
  return { w: 0, h: 0 };
}

export interface TooltipProps {
  /** The trigger element — returned inline as the root of Tooltip. */
  trigger: Instance;
  /** Short text label rendered inside the default dark bubble. */
  label?: string;
  /** Custom content Instance — used instead of label if provided. */
  children?: Instance;
  side?: Side;
  /**
   * Hover delay in ms. Not implemented via browser setTimeout (platform-agnostic).
   * v1: immediate show (delay value is accepted but not acted on — documented
   * limitation; use host.scheduler in a future pass for true deferral).
   */
  delay?: number;
  style?: StyleInput;
  // Legacy alias kept for backward compat (old API used `content`)
  content?: Instance;
}

export function Tooltip(props: TooltipProps): Instance {
  const trigger = props.trigger;
  const side = props.side ?? 'top';
  const overlays = useOverlays();
  const theme = useWidgetTheme();

  const [shown, setShown] = createSignal(false);

  // Chain existing pointer handlers on trigger
  const prevEnter = trigger.handlers?.onPointerEnter;
  const prevLeave = trigger.handlers?.onPointerLeave;

  trigger.handlers ??= {};
  trigger.handlers.onPointerEnter = (e) => {
    prevEnter?.(e);
    setShown(true);
  };
  trigger.handlers.onPointerLeave = (e) => {
    prevLeave?.(e);
    setShown(false);
  };

  const portalContent = (): Instance => {
    const appRoot = overlays.appRoot();
    const anchor = appRoot
      ? (getAbsRect(trigger, appRoot) ?? { x: 0, y: 0, width: 0, height: 0 })
      : { x: 0, y: 0, width: 0, height: 0 };
    const vp = safeViewport();

    // Resolve the bubble content
    const bubbleContent: Instance =
      props.children ??
      props.content ??
      Text({
        style: () => ({
          color: theme.colors.surface,
          fontSize: theme.fontSizes.sm,
        }),
        children: props.label ?? '',
      });

    const contentSize = {
      width: bubbleContent.layout.size.w || 80,
      height: bubbleContent.layout.size.h || 28,
    };
    const { x, y } = computePlacement(anchor, contentSize, vp, { side, flip: true });

    // Dark themed bubble: bg = theme.colors.text (inverted), pointer-events:none
    const defaultBubbleStyle: StyleInput = () => ({
      backgroundColor: theme.colors.text,
      borderRadius: theme.radii.sm,
      padding: theme.spacing.xs,
      pointerEvents: 'none' as const,
    });

    const bubble = Box({
      left: x,
      top: y,
      style: mergeStyles(defaultBubbleStyle, props.style),
      children: bubbleContent,
    });

    // ── Semantics: tooltip role on the bubble ──
    const bubbleSemantics: SemanticsNode = {
      role: 'tooltip',
      label: props.label,
    };
    (bubble as any).semantics = bubbleSemantics;

    return Portal({
      children: Stack({
        children: bubble,
      }),
    });
  };

  createEffect(() => {
    if (shown()) portalContent();
  });

  return trigger;
}
