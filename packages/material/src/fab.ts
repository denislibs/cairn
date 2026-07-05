import type { Instance } from '@cairn/runtime';
import { useTheme } from '@cairn/style';
import { Stack } from '@cairn/primitives';
import { Button as HeadlessButton, type ButtonProps as HeadlessButtonProps } from '@cairn/widgets';
import { createRipple } from './ripple';
import type { MaterialTheme } from './theme';
import type { MaterialColor } from './button';

export interface FabProps {
  icon: Instance;
  color?: MaterialColor;
  size?: number;
  disabled?: boolean;
  onClick?: () => void;
}

export function Fab(props: FabProps): Instance {
  const t = useTheme() as unknown as MaterialTheme;
  const disabled = !!props.disabled;
  const size = props.size ?? 56;
  const borderRadius = size / 2;
  const color = props.color ?? 'primary';
  const c = t.palette[color];

  const ripple = createRipple({ color: c.contrastText, radius: borderRadius });

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
      backgroundColor: c.main,
      boxShadow: t.elevation[6],
      overflow: 'hidden' as const,
      alignX: 'center' as const,
      alignY: 'center' as const,
      cursor: disabled ? 'default' : 'pointer',
      opacity: disabled ? 0.38 : 1,
      hover: {
        boxShadow: t.elevation[8],
      },
      pressed: {
        boxShadow: t.elevation[12],
      },
    }] as any,
    children: childInstance,
  };
  const inst = HeadlessButton(headlessProps);
  inst.debugName = 'Fab';
  return inst;
}
