import { createSignal } from '@cairn/reactivity';
import { useTheme, type BaseStyle, type StateName } from '@cairn/style';
import type { EventHandlers } from '@cairn/events';
import { resolveStyleInput, type StyleInput } from './resolve-input';
import type { EventProps } from './events';

export interface InteractiveProps extends EventProps {
  style?: StyleInput;
}

export interface Interactive {
  resolved: () => BaseStyle; // reactive: re-reads hovered()/pressed()
  handlers: EventHandlers;
}

// Owns the hovered/pressed signals for a primitive, exposes a reactive resolved
// style, and returns handlers that toggle those signals while still calling the
// user's own handlers. pressed is derived locally from bubbled down/up + leave.
export function createInteractive(props: InteractiveProps): Interactive {
  const theme = useTheme();
  const [hovered, setHovered] = createSignal(false);
  const [pressed, setPressed] = createSignal(false);

  const resolved = (): BaseStyle => {
    const states: StateName[] = [];
    if (hovered()) states.push('hover');
    if (pressed()) states.push('pressed');
    return resolveStyleInput(props.style, theme, states);
  };

  const handlers: EventHandlers = {
    onPointerEnter(e) {
      setHovered(true);
      props.onPointerEnter?.(e);
    },
    onPointerLeave(e) {
      setHovered(false);
      setPressed(false);
      props.onPointerLeave?.(e);
    },
    onPointerDown(e) {
      setPressed(true);
      props.onPointerDown?.(e);
    },
    onPointerUp(e) {
      setPressed(false);
      props.onPointerUp?.(e);
    },
  };
  if (props.onClick) handlers.onClick = props.onClick;
  if (props.onPointerMove) handlers.onPointerMove = props.onPointerMove;
  if (props.onWheel) handlers.onWheel = props.onWheel;

  return { resolved, handlers };
}
