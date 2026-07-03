import { createSignal, type Accessor } from '@cairn/reactivity';
import type { EventProps } from '@cairn/primitives';

export interface ControlState {
  hovered: Accessor<boolean>;
  pressed: Accessor<boolean>;
  focused: Accessor<boolean>;
  focusVisible: Accessor<boolean>;
  disabled: boolean;
}

// ControlProps extends EventProps but overrides onClick to a simpler () => void
// so that widgets can wire a plain action without a pointer event argument.
export interface ControlProps extends Omit<EventProps, 'onClick'> {
  disabled?: boolean;
  onClick?: () => void;
}

export interface ControlResult {
  state: ControlState;
  handlers: EventProps;
  setFocusVisible: (v: boolean) => void;
}

export function createControl(props: ControlProps): ControlResult {
  const [hovered, setHovered] = createSignal(false);
  const [pressed, setPressed] = createSignal(false);
  const [focused, setFocused] = createSignal(false);
  const [focusVisible, setFocusVisible] = createSignal(false);
  const disabled = !!props.disabled;

  const handlers: EventProps = {
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
      if (!disabled) setPressed(true);
      props.onPointerDown?.(e);
    },
    onPointerUp(e) {
      setPressed(false);
      props.onPointerUp?.(e);
    },
    onFocus(e) {
      setFocused(true);
      props.onFocus?.(e);
    },
    onBlur(e) {
      setFocused(false);
      props.onBlur?.(e);
    },
    onClick(e) {
      // Guard: non-primary button clicks (e.g. right-click) must not activate.
      if ((e as any)?.button !== undefined && (e as any).button !== 0) return;
      if (!disabled) props.onClick?.();
    },
    onKeyDown(e) {
      // Canvas keyboard fallback: used when no AccessibilityBridge is present.
      if (!disabled && (e.key === ' ' || e.key === 'Enter')) {
        props.onClick?.();
      }
      props.onKeyDown?.(e);
    },
    onKeyUp(e) {
      props.onKeyUp?.(e);
    },
    onPointerMove(e) {
      props.onPointerMove?.(e);
    },
    onWheel(e) {
      props.onWheel?.(e);
    },
  };

  const state: ControlState = { hovered, pressed, focused, focusVisible, disabled };

  return { state, handlers, setFocusVisible };
}
