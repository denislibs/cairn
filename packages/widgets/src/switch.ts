import type { Instance, SemanticsNode } from '@cairn/runtime';
import { createSignal, createEffect, type Accessor } from '@cairn/reactivity';
import { Box, Row, Text, Stack, applyLayoutChildProps, mergeStyles, type StyleInput, type LayoutChildProps } from '@cairn/primitives';
import { useWidgetTheme } from './theme';
import { createControl } from './control';

// Track dimensions
const TRACK_W = 44;
const TRACK_H = 24;

// Thumb dimensions
const THUMB_SIZE = 20;
const THUMB_RADIUS = 10;
const THUMB_TOP = 2;
const THUMB_LEFT_OFF = 2;
const THUMB_LEFT_ON = 22;

export interface SwitchProps extends LayoutChildProps {
  /** Controlled checked state — accessor or plain boolean. */
  checked?: boolean | Accessor<boolean>;
  /** Initial state for uncontrolled mode. */
  defaultChecked?: boolean;
  onChange?: (v: boolean) => void;
  disabled?: boolean;
  label?: string;
  style?: StyleInput;
}

export function Switch(props: SwitchProps): Instance {
  const t = useWidgetTheme();

  // --- Controlled / uncontrolled ---
  const controlled = props.checked !== undefined;
  const [internal, setInternal] = createSignal(props.defaultChecked ?? false);

  const read: Accessor<boolean> = (): boolean => {
    if (controlled) {
      const c = props.checked!;
      return typeof c === 'function' ? (c as Accessor<boolean>)() : (c as boolean);
    }
    return internal();
  };

  const toggle = (): void => {
    if (props.disabled) return;
    const next = !read();
    if (!controlled) setInternal(next);
    props.onChange?.(next);
  };

  const { handlers, setFocusVisible } = createControl({
    disabled: props.disabled,
    onClick: toggle,
  });

  // --- Semantics ---
  const semantics: SemanticsNode = {
    role: 'switch',
    label: props.label,
    checked: read(),
    disabled: !!props.disabled,
    onActivate: toggle,
    onFocus: (keyboard: boolean) => setFocusVisible(keyboard),
    onBlur: () => setFocusVisible(false),
  };
  createEffect(() => {
    semantics.checked = read();
  });

  // Thumb: a Stack direct child with reactive `left` driven by read()
  const thumb = Box({
    style: () => ({
      width: THUMB_SIZE,
      height: THUMB_SIZE,
      borderRadius: THUMB_RADIUS,
      backgroundColor: t.colors.onPrimary,
      left: read() ? THUMB_LEFT_ON : THUMB_LEFT_OFF,
      top: THUMB_TOP,
    }),
  });

  // Track: reactive background color
  const track = Box({
    style: mergeStyles(
      () => ({
        width: TRACK_W,
        height: TRACK_H,
        borderRadius: t.radii.pill,
        backgroundColor: read() ? t.colors.trackOn : t.colors.trackOff,
        cursor: props.disabled ? 'default' : 'pointer',
        opacity: props.disabled ? 0.5 : 1,
        focus: {
          boxShadow: { blur: 4, spread: 2, color: t.colors.focusRing, offsetX: 0, offsetY: 0 },
        },
      }),
      props.style,
    ),
    focusable: true,
    ...handlers,
    children: Stack({ children: thumb }),
  });

  let instance: Instance;
  if (props.label) {
    instance = Row({
      mainAxisSize: 'min',
      style: { gap: t.spacing.sm },
      children: [
        track,
        Text({
          style: () => ({
            color: props.disabled ? t.colors.textDisabled : t.colors.text,
            fontSize: t.fontSizes.sm,
          }),
          children: props.label,
        }),
      ],
    });
  } else {
    instance = track;
  }

  instance.semantics = semantics;
  applyLayoutChildProps(instance, props);
  instance.debugName = 'Switch';
  return instance;
}
