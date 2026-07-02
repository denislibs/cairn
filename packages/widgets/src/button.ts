import type { Instance } from '@cairn/runtime';
import { Box, Text, applyLayoutChildProps, type StyleInput, type LayoutChildProps } from '@cairn/primitives';
import type { Style } from '@cairn/style';

export interface ButtonProps extends LayoutChildProps {
  label?: string;
  children?: Instance;
  variant?: 'primary' | 'secondary' | 'ghost';
  disabled?: boolean;
  onClick?: () => void;
  style?: StyleInput;
}

const VARIANTS: Record<'primary' | 'secondary' | 'ghost', Style> = {
  primary: {
    backgroundColor: '#4577e6', color: '#fff',
    hover: { backgroundColor: '#5482ea' }, pressed: { backgroundColor: '#3f6ad0' },
    disabled: { backgroundColor: '#9db4e8', color: '#eef2ff' },
  },
  secondary: {
    backgroundColor: '#2a2a2c', color: '#e5e7eb', border: { width: 1, color: '#3a3a3e' },
    hover: { backgroundColor: '#333336' },
    disabled: { backgroundColor: '#1f1f21', color: '#6b7280' },
  },
  ghost: {
    backgroundColor: '#00000000', color: '#d1d5db',
    hover: { backgroundColor: '#ffffff14' },
    disabled: { color: '#6b7280' },
  },
};

const BASE: Style = {
  padding: { top: 10, bottom: 10, left: 16, right: 16 },
  borderRadius: 12,
  alignX: 'center',
  alignY: 'center',
};

function toStyleArray(s?: StyleInput): Style[] {
  if (s == null) return [];
  if (typeof s === 'function') return []; // function-form style merge deferred to a later phase (documented)
  return Array.isArray(s) ? (s as Style[]) : [s as Style];
}

export function Button(props: ButtonProps): Instance {
  const variant = VARIANTS[props.variant ?? 'primary'];
  const styles: Style[] = [BASE, variant, ...toStyleArray(props.style)];
  // Apply the disabled visual directly (createInteractive has no disabled signal).
  if (props.disabled && variant.disabled) styles.push(variant.disabled);

  const activate = (): void => {
    if (!props.disabled) props.onClick?.();
  };

  const labelColor = props.disabled ? variant.disabled?.color ?? variant.color : variant.color;
  const instance = Box({
    style: styles,
    focusable: true,
    onClick: () => activate(),
    onKeyDown: (e) => { if (e.key === 'Enter' || e.key === ' ') activate(); },
    children: props.children ?? Text({ style: { color: labelColor }, children: props.label ?? '' }),
  });
  // Forward layout child-props (flex/margin/alignSelf/…) so a Button composes in Flex/Stack.
  applyLayoutChildProps(instance, props);
  return instance;
}
