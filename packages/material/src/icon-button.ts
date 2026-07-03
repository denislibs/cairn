import type { Instance } from '@cairn/runtime';
import { useTheme } from '@cairn/style';
import { Stack } from '@cairn/primitives';
import { Button as HeadlessButton, type ButtonProps as HeadlessButtonProps } from '@cairn/widgets';
import { createRipple } from './ripple';
import { stateOverlay } from './state-layer';
import type { MaterialTheme } from './theme';
import type { MaterialColor } from './button';

export interface IconButtonProps {
  icon: Instance;
  color?: MaterialColor;
  size?: number;
  disabled?: boolean;
  onClick?: () => void;
}

export function IconButton(props: IconButtonProps): Instance {
  const t = useTheme() as unknown as MaterialTheme;
  const disabled = !!props.disabled;
  const size = props.size ?? 40;
  const borderRadius = size / 2;

  const color = props.color ? t.palette[props.color].main : t.palette.text.primary;

  const ripple = createRipple({ color, radius: borderRadius });

  const childInstance = Stack({ children: [props.icon, ripple.instance] });

  const headlessProps: HeadlessButtonProps = {
    variant: 'ghost',
    disabled,
    onClick: props.onClick,
    onPointerDown: (e) => { if (!disabled) ripple.trigger(e.localX ?? 0, e.localY ?? 0); },
    style: [{
      width: size,
      height: size,
      borderRadius,
      backgroundColor: 'transparent',
      overflow: 'hidden' as const,
      alignX: 'center' as const,
      alignY: 'center' as const,
      cursor: disabled ? 'default' : 'pointer',
      opacity: disabled ? 0.38 : 1,
      hover: {
        backgroundColor: stateOverlay(color, 'hover'),
      },
      pressed: {
        backgroundColor: stateOverlay(color, 'pressed'),
      },
    }] as any,
    children: childInstance,
  };
  return HeadlessButton(headlessProps);
}
