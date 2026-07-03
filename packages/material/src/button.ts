import type { Instance } from '@cairn/runtime';
import { useTheme } from '@cairn/style';
import { Stack, Row, Text } from '@cairn/primitives';
import { Button as HeadlessButton, type ButtonProps as HeadlessButtonProps } from '@cairn/widgets';
import { createRipple } from './ripple';
import { stateOverlay } from './state-layer';
import { alpha, darken } from './colors';
import type { MaterialTheme } from './theme';

export type MaterialColor = 'primary' | 'secondary' | 'error' | 'warning' | 'info' | 'success';
export type ButtonVariant = 'contained' | 'outlined' | 'text';

export interface ButtonProps {
  variant?: ButtonVariant;
  color?: MaterialColor;
  disabled?: boolean;
  fullWidth?: boolean;
  startIcon?: Instance;
  label?: string;
  children?: Instance;
  onClick?: () => void;
}

export function Button(props: ButtonProps): Instance {
  const t = useTheme() as unknown as MaterialTheme;
  const color = props.color ?? 'primary';
  const variant = props.variant ?? 'contained';
  const disabled = !!props.disabled;
  const c = t.palette[color];
  const typ = t.typography.button;

  const rippleColor = variant === 'contained' ? c.contrastText : c.main;
  const ripple = createRipple({ color: rippleColor, radius: t.shape.borderRadius });

  const labelText = Text({
    style: {
      color: variant === 'contained' ? c.contrastText : c.main,
      fontSize: typ.fontSize,
      fontWeight: typ.fontWeight,
      letterSpacing: typ.letterSpacing,
      textTransform: typ.textTransform ?? 'uppercase',
    },
    children: props.label ?? '',
  });

  const rowChildren: Instance[] = [];
  if (props.startIcon) rowChildren.push(props.startIcon);
  rowChildren.push(labelText);

  const content = Row({ children: rowChildren, style: { gap: 8, alignX: 'center', alignY: 'center' } });
  const childInstance = props.children ?? Stack({ children: [content, ripple.instance] });

  // Base style common to all variants
  const baseStyle = {
    borderRadius: t.shape.borderRadius,
    overflow: 'hidden' as const,
    height: 36,
    padding: { left: 16, right: 16, top: 0, bottom: 0 },
    alignX: 'center' as const,
    alignY: 'center' as const,
    cursor: disabled ? 'default' : 'pointer',
    opacity: disabled ? 0.38 : 1,
  };

  let variantStyle: object;
  switch (variant) {
    case 'contained':
      variantStyle = {
        backgroundColor: c.main,
        boxShadow: t.elevation[2],
        hover: {
          backgroundColor: darken(c.main, 0.05),
          boxShadow: t.elevation[4],
        },
        pressed: {
          backgroundColor: darken(c.main, 0.1),
          boxShadow: t.elevation[8],
        },
      };
      break;
    case 'outlined':
      variantStyle = {
        backgroundColor: 'transparent',
        border: { width: 1, color: alpha(c.main, 0.5) },
        hover: {
          backgroundColor: stateOverlay(c.main, 'hover'),
        },
        pressed: {
          backgroundColor: stateOverlay(c.main, 'pressed'),
        },
      };
      break;
    case 'text':
    default:
      variantStyle = {
        backgroundColor: 'transparent',
        hover: {
          backgroundColor: stateOverlay(c.main, 'hover'),
        },
        pressed: {
          backgroundColor: stateOverlay(c.main, 'pressed'),
        },
      };
      break;
  }

  const fullWidthStyle = props.fullWidth ? { width: '100%' as any } : {};

  // The headless Button forwards onPointerDown (typed via EventProps) to createControl,
  // so passing it here wires the ripple to every pointer-down event. All keyboard/
  // disabled/click/focus behaviour comes from the headless Button — nothing duplicated.
  const headlessProps: HeadlessButtonProps = {
    variant: 'ghost',
    disabled,
    onClick: props.onClick,
    onPointerDown: (e) => { if (!disabled) ripple.trigger(e.localX ?? 0, e.localY ?? 0); },
    style: [{ ...baseStyle, ...variantStyle, ...fullWidthStyle }] as any,
    children: childInstance,
  };
  return HeadlessButton(headlessProps);
}
