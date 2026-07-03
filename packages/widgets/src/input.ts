import type { Instance } from '@cairn/runtime';
import { Box, Input as TextField, applyLayoutChildProps, mergeStyles, type StyleInput, type LayoutChildProps } from '@cairn/primitives';
import { createSignal, type Accessor } from '@cairn/reactivity';
import type { MaybeReactive } from '@cairn/runtime';
import { useWidgetTheme } from './theme';
import { useFieldOptional } from './field';

// ─── Props ────────────────────────────────────────────────────────────────────

export interface InputProps extends LayoutChildProps {
  value?: MaybeReactive<string>;
  defaultValue?: string;
  onInput?: (text: string) => void;
  /** Alias for onInput — fires on each keystroke. */
  onChange?: (text: string) => void;
  onSubmit?: (text: string) => void;
  placeholder?: MaybeReactive<string>;
  disabled?: boolean;
  invalid?: boolean | Accessor<boolean>;
  size?: 'sm' | 'md' | 'lg';
  /** Style applied to the outer frame Box. */
  style?: StyleInput;
  /** Style applied to the inner TextField. */
  inputStyle?: StyleInput;
}

// ─── Input ────────────────────────────────────────────────────────────────────

export function Input(props: InputProps): Instance {
  const t = useWidgetTheme();

  // Optional field context for invalid/disabled defaults
  const field = useFieldOptional();

  const size = props.size ?? 'md';

  // Resolve invalid: props.invalid > field.invalid > false
  const resolveInvalid = (): boolean => {
    if (props.invalid !== undefined) {
      return typeof props.invalid === 'function'
        ? (props.invalid as Accessor<boolean>)()
        : (props.invalid as boolean);
    }
    return field ? field.invalid() : false;
  };

  // Resolve disabled: props.disabled > field.disabled > false
  const isDisabled = props.disabled ?? (field ? field.disabled : false);

  // Lift focus from the inner TextField into a signal so the frame can react.
  const [focused, setFocused] = createSignal(false);

  // Frame Box style: function-form so focused()/resolveInvalid() are tracked reactively.
  const frameStyle: StyleInput = () => {
    const inv = resolveInvalid();
    const foc = focused();
    return {
      backgroundColor: t.colors.surface,
      border: {
        width: 1,
        color: inv ? t.colors.danger : t.colors.borderStrong,
      },
      borderRadius: t.radii.md,
      padding: {
        left: t.control.padX[size],
        right: t.control.padX[size],
        top: 0,
        bottom: 0,
      },
      height: t.control.height[size],
      opacity: isDisabled ? 0.5 : 1,
      // Focus ring applied to frame via box-shadow when inner field is focused
      ...(foc
        ? {
            boxShadow: {
              blur: 0,
              spread: 2,
              color: inv ? t.colors.danger : t.colors.focusRing,
              offsetX: 0,
              offsetY: 0,
            },
          }
        : {}),
    };
  };

  // Inner TextField styled transparent
  const innerStyle: StyleInput = mergeStyles(
    () => ({
      backgroundColor: 'transparent',
      width: '100%' as any,
      color: isDisabled ? t.colors.textDisabled : t.colors.text,
      font: `${t.fontSizes.sm}px sans-serif`,
      height: t.control.height[size],
    }),
    props.inputStyle,
  );

  // Resolve value prop for inner TextField
  const innerValue = props.value;

  const innerTextField = TextField({
    value: innerValue,
    onInput: (text) => {
      props.onInput?.(text);
      props.onChange?.(text);
    },
    onSubmit: props.onSubmit,
    placeholder: props.placeholder,
    style: innerStyle,
    onFocus: () => {
      if (!isDisabled) setFocused(true);
    },
    onBlur: () => {
      setFocused(false);
    },
  });

  // The frame Box is NOT focusable — only the inner TextField is.
  const instance = Box({
    style: mergeStyles(frameStyle, props.style),
    focusable: false,
    children: innerTextField,
  });

  applyLayoutChildProps(instance, props);
  return instance;
}
