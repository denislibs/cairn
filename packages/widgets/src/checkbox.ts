import type { Instance } from '@cairn/runtime';
import { Show } from '@cairn/runtime';
import { createSignal, type Accessor } from '@cairn/reactivity';
import { Box, Row, Column, Text, Icon, applyLayoutChildProps, mergeStyles, type StyleInput, type LayoutChildProps } from '@cairn/primitives';
import { useWidgetTheme } from './theme';
import { createControl, type ControlState } from './control';

const CHECK = 'M20 6L9 17l-5-5';
const DASH = 'M5 12h14';

export interface CheckboxProps extends LayoutChildProps {
  checked?: boolean | Accessor<boolean>;
  defaultChecked?: boolean;
  indeterminate?: boolean;
  onChange?: (v: boolean) => void;
  disabled?: boolean;
  label?: string;
  style?: StyleInput;
  children?: Instance | ((state: ControlState & { checked: Accessor<boolean> }) => Instance);
}

export function Checkbox(props: CheckboxProps): Instance {
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

  const { state, handlers } = createControl({
    disabled: props.disabled,
    onClick: toggle,
  });

  // --- Render-fn slot ---
  if (typeof props.children === 'function') {
    const childState = { ...state, checked: read };
    const child = props.children(childState);
    const instance = Box({
      style: mergeStyles(props.style),
      focusable: true,
      ...handlers,
      children: child,
    });
    applyLayoutChildProps(instance, props);
    return instance;
  }

  // --- Default visual ---
  // Function-form style so read()/indeterminate react on each access.
  const boxStyle: StyleInput = () => ({
    width: 18,
    height: 18,
    borderRadius: t.radii.sm,
    backgroundColor: read() || props.indeterminate ? t.colors.primary : 'transparent',
    border: {
      width: 2,
      color: read() || props.indeterminate ? t.colors.primary : t.colors.borderStrong,
    },
    alignX: 'center' as const,
    alignY: 'center' as const,
    cursor: props.disabled ? 'default' : 'pointer',
    opacity: props.disabled ? 0.5 : 1,
    hover: {
      border: { width: 2, color: t.colors.primary },
    },
    focus: {
      boxShadow: { blur: 4, spread: 2, color: t.colors.focusRing, offsetX: 0, offsetY: 0 },
    },
  });

  // Single Show: checkmark or dash icon when active
  const iconShow = Show({
    when: () => read() || !!props.indeterminate,
    children: () =>
      Icon({
        path: props.indeterminate ? DASH : CHECK,
        size: 12,
        color: t.colors.onPrimary,
      }),
  });

  // The visual checkbox box — Box only accepts a single Instance child,
  // so we wrap the Show in a Column (centering, min-size).
  const iconContainer = Column({
    mainAxisSize: 'min',
    style: { alignX: 'center' as const, alignY: 'center' as const },
    children: iconShow,
  });

  const checkboxBox = Box({
    style: boxStyle,
    children: iconContainer,
  });

  // Compose: if label, wrap in a Row; otherwise just the box
  const composedStyle = mergeStyles(props.style);

  let instance: Instance;
  if (props.label) {
    instance = Row({
      mainAxisSize: 'min',
      style: mergeStyles({ gap: t.spacing.sm }, composedStyle),
      focusable: true,
      ...handlers,
      children: [
        checkboxBox,
        Text({
          style: () => ({
            color: props.disabled ? t.colors.textDisabled : t.colors.text,
            fontSize: t.fontSizes.sm,
            lineHeight: 20,
          }),
          children: props.label,
        }),
      ],
    });
  } else {
    // No label: the checkbox box IS the interactive root
    instance = Box({
      style: mergeStyles(boxStyle, composedStyle),
      focusable: true,
      ...handlers,
      children: iconContainer,
    });
  }

  applyLayoutChildProps(instance, props);
  return instance;
}
