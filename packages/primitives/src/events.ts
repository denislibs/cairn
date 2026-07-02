import type { EventHandlers, CairnPointerEvent, CairnWheelEvent, CairnKeyboardEvent, CairnFocusEvent } from '@cairn/events';

// Event props shared by all primitives. Kept separate so each primitive's props
// interface can extend it.
export interface EventProps {
  onClick?: (e: CairnPointerEvent) => void;
  onPointerDown?: (e: CairnPointerEvent) => void;
  onPointerMove?: (e: CairnPointerEvent) => void;
  onPointerUp?: (e: CairnPointerEvent) => void;
  onPointerEnter?: (e: CairnPointerEvent) => void;
  onPointerLeave?: (e: CairnPointerEvent) => void;
  onWheel?: (e: CairnWheelEvent) => void;
  onKeyDown?: (e: CairnKeyboardEvent) => void;
  onKeyUp?: (e: CairnKeyboardEvent) => void;
  onFocus?: (e: CairnFocusEvent) => void;
  onBlur?: (e: CairnFocusEvent) => void;
}

// Build an EventHandlers object from the provided props, or undefined if none
// were given (so instances without listeners carry no handlers).
export function collectHandlers(props: EventProps): EventHandlers | undefined {
  const h: EventHandlers = {};
  let has = false;
  if (props.onClick) {
    h.onClick = props.onClick;
    has = true;
  }
  if (props.onPointerDown) {
    h.onPointerDown = props.onPointerDown;
    has = true;
  }
  if (props.onPointerMove) {
    h.onPointerMove = props.onPointerMove;
    has = true;
  }
  if (props.onPointerUp) {
    h.onPointerUp = props.onPointerUp;
    has = true;
  }
  if (props.onWheel) {
    h.onWheel = props.onWheel;
    has = true;
  }
  return has ? h : undefined;
}
