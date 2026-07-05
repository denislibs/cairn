import type { Instance } from '@cairn/runtime';
import { Provider } from '@cairn/runtime';
import { useTheme } from '@cairn/style';
import { Box, Column, Row, Stack, Text, Input as PrimitivesInput } from '@cairn/primitives';
import { createSignal } from '@cairn/reactivity';
import { Field, fieldContext } from '@cairn/widgets';
import type { MaterialTheme } from './theme';
import type { MaterialColor } from './button';

// ─── Props ────────────────────────────────────────────────────────────────────

export type TextFieldVariant = 'outlined' | 'filled';

export interface TextFieldProps {
  label?: string;
  value?: string | (() => string);
  defaultValue?: string;
  onInput?: (text: string) => void;
  placeholder?: string;
  variant?: TextFieldVariant;
  color?: MaterialColor;
  disabled?: boolean;
  error?: boolean;
  helperText?: string;
  fullWidth?: boolean;
}

// ─── TextField ────────────────────────────────────────────────────────────────

export function TextField(props: TextFieldProps): Instance {
  const t = useTheme() as unknown as MaterialTheme;
  const color = props.color ?? 'primary';
  const variant = props.variant ?? 'outlined';
  const disabled = !!props.disabled;
  const isError = !!props.error;
  const c = t.palette[color];

  const typ = t.typography;
  const capTyp = typ.caption;

  // ── Focus tracking ──────────────────────────────────────────────────────────
  // We use the primitives Input directly (not headless widgets Input) to get
  // onFocus/onBlur callbacks and track focus ourselves for the floating label.
  const [focused, setFocused] = createSignal(false);

  // ── Value tracking for floating label ───────────────────────────────────────
  // The label floats up when focused OR when there is a value present.
  const [innerValue, setInnerValue] = createSignal(
    props.defaultValue ?? (typeof props.value === 'string' ? props.value : typeof props.value === 'function' ? props.value() : ''),
  );

  const isFloated = (): boolean => {
    const val = typeof props.value === 'function'
      ? props.value()
      : props.value !== undefined
        ? props.value
        : innerValue();
    return focused() || (val !== '' && val != null);
  };

  // ── Colors ──────────────────────────────────────────────────────────────────
  const borderColor = (): string => {
    if (isError) return t.palette.error.main;
    if (focused()) return c.main;
    return t.palette.divider;
  };

  const borderWidth = (): number => focused() ? 2 : 1;

  const labelColor = (): string => {
    if (isError) return t.palette.error.main;
    if (focused()) return c.main;
    return t.palette.text.secondary;
  };

  // ── Floating label ──────────────────────────────────────────────────────────
  // The label is rendered once at its RESTING position (baseline-aligned with the
  // input text) and animated to the floated position with `transform`
  // (translateY + scale) — the Material approach. `top`/`fontSize` are not
  // animatable, but `transform` is, so the built-in `transition` tweens it
  // smoothly instead of teleporting.
  const FIELD_HEIGHT = 56;
  // Resting: text left edge at x=12 (aligned with the input), vertically centred.
  const LABEL_LEFT = 8;          // box left; +4 padding → text at x=12
  const LABEL_BASE_TOP = 18;     // resting top (16px text centred in the field)
  // Floated: move up so the text notches the top border and scale to caption size.
  const FLOAT_SCALE = capTyp.fontSize / typ.body1.fontSize; // ~0.75
  const FLOAT_TRANSLATE_Y = variant === 'outlined' ? -28 : -12;

  const labelBgColor = (): string => {
    // Outlined: a paper background "notches" the border once floated.
    if (variant === 'outlined') {
      return isFloated() ? t.palette.background.paper : 'transparent';
    }
    return 'transparent';
  };

  // Positioned absolutely via Stack (top/left); animated via transform.
  const floatingLabel = props.label
    ? Box({
        style: () => ({
          backgroundColor: labelBgColor(),
          padding: { left: 4, right: 4, top: 0, bottom: 0 },
          top: LABEL_BASE_TOP,
          left: LABEL_LEFT,
          transform: isFloated()
            ? { translateY: FLOAT_TRANSLATE_Y, scale: FLOAT_SCALE }
            : { translateY: 0, scale: 1 },
          transformOrigin: { x: 0, y: 0 },
          transition: [{ properties: ['transform', 'backgroundColor'], duration: 150, easing: 'ease-out' }],
          cursor: disabled ? 'default' : 'text',
        }),
        children: Text({
          style: () => ({
            color: labelColor(),
            fontSize: typ.body1.fontSize,
            fontWeight: typ.body1.fontWeight,
          }),
          children: props.label!,
        }),
      })
    : null;

  // ── Input primitive ─────────────────────────────────────────────────────────
  // Use primitives Input directly to get onFocus/onBlur access.
  const inputEl = PrimitivesInput({
    value: props.value ?? innerValue,
    // When a label is present it doubles as the placeholder (resting), so only
    // show the real placeholder while focused — avoids label/placeholder overlap.
    placeholder: props.label ? (props.placeholder && focused() ? props.placeholder : undefined) : props.placeholder,
    style: () => ({
      backgroundColor: 'transparent',
      width: '100%' as any,
      color: disabled ? t.palette.text.disabled : t.palette.text.primary,
      font: `${typ.body1.fontSize}px sans-serif`,
      height: 24,
    }),
    onInput: (text) => {
      setInnerValue(text);
      props.onInput?.(text);
    },
    onFocus: () => {
      if (!disabled) setFocused(true);
    },
    onBlur: () => {
      setFocused(false);
    },
  });

  // ── Surface box (border / background) ───────────────────────────────────────
  // MUST be a Box — Row/Column do not paint backgroundColor/border/borderRadius.
  const surfaceStyle = () => {
    const base = {
      height: FIELD_HEIGHT,
      borderRadius: variant === 'outlined' ? t.shape.borderRadius : `${t.shape.borderRadius}px ${t.shape.borderRadius}px 0 0` as any,
      width: props.fullWidth ? ('100%' as any) : undefined,
      opacity: disabled ? 0.38 : 1,
      // Position the input vertically with padding (the input renders correctly
      // at its natural 24px height). The floated label notches the top border
      // (outlined) / sits near the top (filled) as a non-layout overlay.
      padding: { left: 12, right: 12, top: props.label ? 20 : 16, bottom: 8 },
      cursor: disabled ? 'default' : 'text',
    };

    if (variant === 'outlined') {
      return {
        ...base,
        backgroundColor: 'transparent',
        border: {
          width: borderWidth(),
          color: borderColor(),
        },
      };
    }

    // filled
    return {
      ...base,
      backgroundColor: t.palette.background.paper,
      borderBottom: {
        width: borderWidth(),
        color: borderColor(),
      },
    };
  };

  // Build a Stack to overlay the floating label over the input area.
  const stackChildren: Instance[] = [];
  const surfaceBox = Box({
    style: surfaceStyle,
    children: inputEl,
  });
  stackChildren.push(surfaceBox);
  if (floatingLabel) {
    // The label is a positioned overlay — it must NOT drive the Stack's size
    // (otherwise its top offset + transform inflate the field's height).
    (floatingLabel.layout as { overlay?: boolean }).overlay = true;
    stackChildren.push(floatingLabel);
  }

  const fieldBody = Stack({ children: stackChildren });

  // ── Helper / error text ─────────────────────────────────────────────────────
  const columnChildren: Instance[] = [fieldBody];

  if (props.helperText) {
    const helperStyle = () => ({
      color: isError ? t.palette.error.main : t.palette.text.secondary,
      fontSize: capTyp.fontSize,
      fontWeight: capTyp.fontWeight,
      letterSpacing: capTyp.letterSpacing,
    });
    columnChildren.push(
      Text({
        style: helperStyle,
        children: props.helperText,
      }),
    );
  }

  // ── Field context wrapper ───────────────────────────────────────────────────
  // Wrap in Field so label/error/helper are properly a11y-associated.
  // We compose manually (not via Field.Label/Field.Control/Field.Error sub-components)
  // because we need precise layout control for the floating label effect.
  const invalid = (): boolean => isError;

  const fieldCtxValue = {
    invalid,
    disabled,
    id: Symbol('TextField'),
    labelText: props.label ?? '',
  };

  const inner = Column({
    mainAxisSize: 'min' as const,
    style: { gap: t.spacing(0.5) },
    children: columnChildren,
  });

  const inst = Provider({
    context: fieldContext.context,
    value: fieldCtxValue,
    children: () => inner,
  }) as unknown as Instance;
  inst.debugName = 'TextField';
  return inst;
}
