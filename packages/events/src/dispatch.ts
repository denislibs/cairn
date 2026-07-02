import type { HitNode, CairnPointerEvent, CairnWheelEvent, EventHandlers } from './event';

const POINTER_HANDLERS: Record<CairnPointerEvent['type'], keyof EventHandlers> = {
  pointerdown: 'onPointerDown',
  pointermove: 'onPointerMove',
  pointerup: 'onPointerUp',
  pointerenter: 'onPointerEnter',
  pointerleave: 'onPointerLeave',
  click: 'onClick',
};

/** Bubble-only dispatch: target = path[0], walk target -> root until stopPropagation(). */
export function dispatch(
  path: HitNode[],
  init: Omit<CairnPointerEvent, 'target' | 'stopPropagation'>,
): void {
  if (path.length === 0) return;
  let stopped = false;
  const event: CairnPointerEvent = {
    ...init,
    target: path[0],
    stopPropagation() {
      stopped = true;
    },
  };
  const key = POINTER_HANDLERS[init.type];
  for (const node of path) {
    if (stopped) break;
    const fn = node.handlers?.[key] as ((e: CairnPointerEvent) => void) | undefined;
    fn?.(event);
  }
}

/** Bubble-only wheel dispatch mirroring dispatch(). */
export function dispatchWheel(
  path: HitNode[],
  init: Omit<CairnWheelEvent, 'target' | 'stopPropagation'>,
): void {
  if (path.length === 0) return;
  let stopped = false;
  const event: CairnWheelEvent = {
    ...init,
    target: path[0],
    stopPropagation() {
      stopped = true;
    },
  };
  for (const node of path) {
    if (stopped) break;
    node.handlers?.onWheel?.(event);
  }
}

/** Non-bubbling dispatch to a single node (used for enter/leave). */
export function dispatchTo(
  node: HitNode,
  init: Omit<CairnPointerEvent, 'target' | 'stopPropagation'>,
): void {
  const event: CairnPointerEvent = {
    ...init,
    target: node,
    stopPropagation() {
      // single-node dispatch: nothing to stop
    },
  };
  const key = POINTER_HANDLERS[init.type];
  const fn = node.handlers?.[key] as ((e: CairnPointerEvent) => void) | undefined;
  fn?.(event);
}
