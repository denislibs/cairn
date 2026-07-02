import { Show, type Instance } from '@cairn/runtime';
import { createSignal, type Accessor } from '@cairn/reactivity';
import { Row, Box, Text, Icon } from '@cairn/primitives';

export interface CheckboxProps {
  checked?: boolean | Accessor<boolean>;
  defaultChecked?: boolean;
  onChange?: (v: boolean) => void;
  disabled?: boolean;
  label?: string;
}

const CHECK = 'M20 6L9 17l-5-5';

export function Checkbox(props: CheckboxProps): Instance {
  const controlled = props.checked !== undefined;
  const [internal, setInternal] = createSignal(props.defaultChecked ?? false);
  const read = (): boolean =>
    controlled
      ? (typeof props.checked === 'function'
          ? (props.checked as Accessor<boolean>)()
          : (props.checked as boolean))
      : internal();

  const toggle = (): void => {
    if (props.disabled) return;
    const next = !read();
    if (!controlled) setInternal(next);
    props.onChange?.(next);
  };

  const checkMark = Show({
    when: read,
    children: () => Icon({ path: CHECK, size: 16, color: '#4577e6' }),
  });

  const boxInst = Box({
    style: { width: 20, height: 20, borderRadius: 4, border: { width: 2, color: '#6b7280' }, alignX: 'center', alignY: 'center' },
    children: checkMark,
  });

  const children: Instance[] = props.label
    ? [boxInst, Text({ style: { color: '#e5e7eb', lineHeight: 20 }, children: props.label })]
    : [boxInst];

  return Row({
    style: { gap: 8, align: 'center' },
    focusable: true,
    onClick: () => toggle(),
    onKeyDown: (e) => { if (e.key === ' ' || e.key === 'Enter') toggle(); },
    children,
  });
}
