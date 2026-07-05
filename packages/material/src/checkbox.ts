import type { Instance } from '@cairn/runtime';
import { Show } from '@cairn/runtime';
import { useTheme } from '@cairn/style';
import { Box, Row, Text, Stack, Icon } from '@cairn/primitives';
import {
  Checkbox as HeadlessCheckbox,
  type CheckboxProps as HeadlessCheckboxProps,
  type ControlState,
} from '@cairn/widgets';
import type { Accessor } from '@cairn/reactivity';
import { createRipple } from './ripple';
import { alpha } from './colors';
import type { MaterialTheme } from './theme';
import type { MaterialColor } from './button';

export interface CheckboxProps {
  checked?: boolean | Accessor<boolean>;
  defaultChecked?: boolean;
  onChange?: (v: boolean) => void;
  disabled?: boolean;
  color?: MaterialColor;
  label?: string;
}

const CHECK_PATH = 'M20 6L9 17l-5-5';

export function Checkbox(props: CheckboxProps): Instance {
  const t = useTheme() as unknown as MaterialTheme;
  const color = props.color ?? 'primary';
  const disabled = !!props.disabled;
  const c = t.palette[color];

  // createRipple must be called inside the reactive owner (component init).
  const ripple = createRipple({ color: alpha(c.main, 1), radius: 10, duration: 400 });

  // The render slot receives (ControlState & { checked: Accessor<boolean> }).
  // We draw the Material checkbox: state-layer circle + outlined/filled box + check glyph.
  function renderSlot(slotState: ControlState & { checked: Accessor<boolean> }): Instance {
    const isChecked = slotState.checked;

    // Visual box — reactive style: unchecked = outlined in text.secondary,
    // checked = filled with palette[color].main.
    const boxStyle = (): object => {
      const checked = isChecked();
      return {
        width: 18,
        height: 18,
        borderRadius: t.shape.borderRadius,
        backgroundColor: checked ? c.main : 'transparent',
        border: {
          width: 2,
          color: checked ? c.main : t.palette.text.secondary,
        },
        alignX: 'center' as const,
        alignY: 'center' as const,
        opacity: disabled ? 0.38 : 1,
        cursor: disabled ? 'default' : 'pointer',
      };
    };

    // Check icon shown only when checked. Show swaps the child reactively.
    const checkIconShow = Show({
      when: isChecked,
      children: () => Icon({ path: CHECK_PATH, size: 12, color: c.contrastText }),
    });

    // The visual checkbox Box wraps the Show icon.
    const visualBox = Box({
      style: boxStyle,
      children: checkIconShow,
    });

    // State-layer circle behind the box: changes alpha based on hover/press/focus.
    // Ripple also fires from the pressed state change (triggered by headless pointer events).
    const stateLayerStyle = (): object => {
      const checked = isChecked();
      const baseColor = checked ? c.main : t.palette.text.secondary;
      const layerOpacity = slotState.pressed()
        ? 0.12
        : slotState.hovered() || slotState.focused()
        ? 0.08
        : 0;
      return {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: layerOpacity > 0 ? alpha(baseColor, layerOpacity) : 'transparent',
        alignX: 'center' as const,
        alignY: 'center' as const,
      };
    };

    // Stack: ripple behind the visual box, both centred in the state-layer circle.
    const innerStack = Stack({ children: [ripple.instance, visualBox] });

    const stateCircle = Box({
      style: stateLayerStyle,
      children: innerStack,
    });

    return stateCircle;
  }

  // Build headless props. We do not pass onPointerDown because CheckboxProps
  // does not include EventProps — the ripple is driven by slotState.pressed() instead.
  const headlessProps: HeadlessCheckboxProps = {
    checked: props.checked,
    defaultChecked: props.defaultChecked,
    onChange: props.onChange,
    disabled: props.disabled,
    label: props.label,
    children: renderSlot,
  };

  const inst = HeadlessCheckbox(headlessProps);

  // When the caller provides a label, the headless Checkbox is already set up to
  // show the label in its default path. However, because we pass children as a
  // render function the headless widget uses the render-slot branch (no label Row).
  // We therefore wrap the result in a Row with a Text label here.
  if (props.label) {
    const typ = t.typography.body2;
    const labelText = Text({
      style: {
        color: disabled ? t.palette.text.disabled : t.palette.text.primary,
        fontSize: typ.fontSize,
        fontWeight: typ.fontWeight,
        lineHeight: typ.lineHeight,
        letterSpacing: typ.letterSpacing,
      },
      children: props.label,
    });

    const row = Row({
      mainAxisSize: 'min',
      style: { gap: 8, alignY: 'center' as const },
      children: [inst, labelText],
    });

    // Move semantics/focus/handlers UP to the row so the returned instance is the
    // single a11y node (covering box + label). They must be CLEARED from `inst`
    // to avoid emitting a duplicate node (inst is collected as a child of row).
    row.semantics = inst.semantics;
    row.focusable = inst.focusable;
    row.handlers = inst.handlers;
    inst.semantics = undefined;
    inst.focusable = false;
    inst.handlers = undefined;
    row.debugName = 'Checkbox';
    return row;
  }

  inst.debugName = 'Checkbox';
  return inst;
}
