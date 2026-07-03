import type { Instance, SemanticsNode } from '@cairn/runtime';
import { useOverlays, hostContext } from '@cairn/runtime';
import { createSignal, createEffect, useContext, type Accessor } from '@cairn/reactivity';
import { Portal, Box, Stack, computePlacement, getAbsRect, mergeStyles, type StyleInput, type Side } from '@cairn/primitives';
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

export interface PopoverProps {
  /** The trigger element — returned inline as the root of Popover. */
  trigger: Instance;
  /** The popover content. */
  children: Instance;
  side?: Side;
  align?: 'start' | 'center' | 'end';
  offset?: number;
  /**
   * Controlled open state. When provided (as a boolean or Accessor<boolean>),
   * Popover does NOT toggle internally — it calls onOpenChange instead.
   */
  open?: boolean | Accessor<boolean>;
  /** Initial open state for uncontrolled usage. */
  defaultOpen?: boolean;
  /** Fires with the next desired open value. */
  onOpenChange?: (open: boolean) => void;
  style?: StyleInput;
  // Legacy alias kept for backward compat (old API used `content`)
  content?: Instance;
}

export function Popover(props: PopoverProps): Instance {
  const trigger = props.trigger;
  const content = props.children ?? props.content!;
  const side = props.side ?? 'bottom';
  const align = props.align ?? 'start';
  const offset = props.offset ?? 4;
  const overlays = useOverlays();
  const theme = useWidgetTheme();

  // Determine controlled vs. uncontrolled
  const isControlled = props.open !== undefined;
  const resolveOpen = (): boolean =>
    typeof props.open === 'function'
      ? (props.open as Accessor<boolean>)()
      : (props.open as boolean) ?? false;

  const [internalOpen, setInternalOpen] = createSignal(props.defaultOpen ?? false);

  const open = (): boolean => (isControlled ? resolveOpen() : internalOpen());

  const toggle = (): void => {
    const next = !open();
    if (isControlled) {
      props.onOpenChange?.(next);
    } else {
      setInternalOpen(next);
      props.onOpenChange?.(next);
    }
  };

  const close = (): void => {
    if (isControlled) {
      props.onOpenChange?.(false);
    } else {
      setInternalOpen(false);
      props.onOpenChange?.(false);
    }
  };

  // Chain existing onClick on trigger
  const prevClick = trigger.handlers?.onClick;
  trigger.handlers ??= {};
  trigger.handlers.onClick = (e) => {
    prevClick?.(e);
    toggle();
  };

  // ── Semantics: reflect expanded on trigger ──
  // If the trigger already has semantics (e.g. it's a Button), mutate its
  // expanded field; otherwise create a minimal semantics node.
  const existingSem = (trigger as any).semantics as SemanticsNode | undefined;
  if (existingSem) {
    existingSem.expanded = false;
    createEffect(() => { existingSem.expanded = open(); });
  } else {
    const triggerSemantics: SemanticsNode = { role: 'button', expanded: false };
    (trigger as any).semantics = triggerSemantics;
    createEffect(() => { triggerSemantics.expanded = open(); });
  }

  const portalContent = (): Instance => {
    const appRoot = overlays.appRoot();
    const anchor = appRoot
      ? (getAbsRect(trigger, appRoot) ?? { x: 0, y: 0, width: 0, height: 0 })
      : { x: 0, y: 0, width: 0, height: 0 };
    const vp = safeViewport();
    const contentSize = {
      width: content.layout.size.w || 160,
      height: content.layout.size.h || 40,
    };
    const { x, y } = computePlacement(anchor, contentSize, vp, { side, align, offset, flip: true });

    // Full-surface transparent catcher — closes on click or Escape
    const catcher = Box({
      style: { width: '100%', height: '100%' },
      focusable: true,
      onClick: (e) => {
        e.stopPropagation?.();
        close();
      },
      onKeyDown: (e) => {
        if (e.key === 'Escape') close();
      },
    });

    // Themed surface box wrapping the content, positioned absolutely
    const defaultSurfaceStyle: StyleInput = () => ({
      backgroundColor: theme.colors.surface,
      border: { width: 1, color: theme.colors.borderStrong },
      borderRadius: theme.radii.md,
      boxShadow: { color: 'rgba(0,0,0,0.12)', blur: 12, offsetX: 0, offsetY: 4 },
      padding: theme.spacing.sm,
    });

    const contentBox = Box({
      left: x,
      top: y,
      style: mergeStyles(defaultSurfaceStyle, props.style),
      children: content,
      onClick: (e) => { e.stopPropagation?.(); },
    });

    return Portal({
      children: Stack({
        children: [catcher, contentBox],
      }),
    });
  };

  createEffect(() => {
    if (open()) portalContent();
  });

  return trigger;
}
