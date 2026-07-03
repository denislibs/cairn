import type { Instance } from '@cairn/runtime';
import { Show, useOverlays } from '@cairn/runtime';
import { createSignal, useContext } from '@cairn/reactivity';
import { Portal, Box, Stack, computePlacement, getAbsRect } from '@cairn/primitives';
import { hostContext } from '@cairn/runtime';
import type { Side } from '@cairn/primitives';

export interface TooltipProps {
  content: Instance;
  children: Instance;
  side?: Side;
}

function safeViewport(): { w: number; h: number } {
  try {
    const host = useContext(hostContext);
    if (host) return { w: host.metrics.width, h: host.metrics.height };
  } catch {
    // not mounted
  }
  return { w: 0, h: 0 };
}

export function Tooltip(props: TooltipProps): Instance {
  const trigger = props.children;
  const side = props.side ?? 'top';
  const overlays = useOverlays();

  const [shown, setShown] = createSignal(false);

  // Chain existing handlers
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
    const contentSize = {
      width: props.content.layout.size.w || 160,
      height: props.content.layout.size.h || 40,
    };
    const { x, y } = computePlacement(anchor, contentSize, vp, { side });

    return Portal({
      children: Stack({
        children: Box({
          left: x,
          top: y,
          children: props.content,
        }),
      }),
    });
  };

  return Stack({
    children: [
      trigger,
      Show({ when: shown, children: portalContent }),
    ],
  });
}
