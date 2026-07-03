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

  // Pointer-capture: tracks whether a pointer was pressed down on this element
  // and not yet released. Used to restore visual pressed state on re-enter.
  let pointerDownActive = false;

  const handlers: EventProps = {
    onPointerEnter(e) {
      setHovered(true);
      // Restore visual pressed state if pointer button is still held
      if (pointerDownActive) setPressed(true);
      props.onPointerEnter?.(e);
    },
    onPointerLeave(e) {
      setHovered(false);
      setPressed(false); // clear visual only; pointerDownActive stays true
      props.onPointerLeave?.(e);
    },
    onPointerDown(e) {
      if (!disabled) { setPressed(true); pointerDownActive = true; }
      props.onPointerDown?.(e);
    },
    onPointerUp(e) {
      setPressed(false);
      pointerDownActive = false;
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
      // Use optional access: test harnesses may pass a partial event without button.
      if ((e as any)?.button !== undefined && (e as any).button !== 0) return;
      if (!disabled) props.onClick?.();
    },
    onKeyDown(e) {
      // Canvas keyboard fallback: used when no AccessibilityBridge is present.
      // Enter activates on keydown; Space activates on keyup (button semantics).
      if (!disabled) {
        if (e.key === 'Enter') {
          props.onClick?.();
        } else if (e.key === ' ') {
          // Prevent scroll on Space; activation fires on keyup.
          // Optional call: test harnesses may pass partial events without preventDefault.
          (e as any).preventDefault?.();
        }
      }
      props.onKeyDown?.(e);
    },
    onKeyUp(e) {
      // Space activates on keyup (button semantics)
      if (!disabled && e.key === ' ') {
        props.onClick?.();
      }
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
