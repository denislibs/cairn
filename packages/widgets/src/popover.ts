import type { Instance } from '@cairn/runtime';
import { useOverlays, hostContext } from '@cairn/runtime';
import { createSignal, createEffect, useContext } from '@cairn/reactivity';
import { Portal, Box, Stack, computePlacement, getAbsRect } from '@cairn/primitives';
import type { Side } from '@cairn/primitives';

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
  content: Instance;
  children: Instance;
  side?: Side;
}

export function Popover(props: PopoverProps): Instance {
  const trigger = props.children;
  const side = props.side ?? 'bottom';
  const overlays = useOverlays();

  const [open, setOpen] = createSignal(false);

  // Chain existing onClick handler on trigger
  const prevClick = trigger.handlers?.onClick;

  trigger.handlers ??= {};
  trigger.handlers.onClick = (e) => {
    prevClick?.(e);
    setOpen(!open());
    return;
  };

  const portalContent = (): Instance => {
    const appRoot = overlays.appRoot();
    const anchor = appRoot ? (getAbsRect(trigger, appRoot) ?? { x: 0, y: 0, width: 0, height: 0 }) : { x: 0, y: 0, width: 0, height: 0 };
    const vp = safeViewport();
    const contentSize = {
      width: props.content.layout.size.w || 160,
      height: props.content.layout.size.h || 40,
    };
    const { x, y } = computePlacement(anchor, contentSize, vp, { side });

    const close = (): void => { setOpen(false); };

    // Full-surface transparent catcher that closes on click / Escape
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

    // Positioned content box — stopPropagation so clicks don't bubble to catcher
    const contentBox = Box({
      left: x,
      top: y,
      children: props.content,
      onClick: (e) => { e.stopPropagation?.(); },
    });

    return Portal({
      children: Stack({
        children: [catcher, contentBox],
      }),
    });
  };

  // Register the popover Portal as an overlay while open (self-removes via onCleanup
  // when the effect re-runs on close / owner disposes). The trigger returns inline;
  // top-layer rendering is handled by the overlay layer, so no wrapping Stack.
  createEffect(() => {
    if (open()) portalContent();
  });

  return trigger;
}
