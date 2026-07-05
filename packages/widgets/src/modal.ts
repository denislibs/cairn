import type { Instance } from '@cairn/runtime';
import { Show } from '@cairn/runtime';
import { type Accessor } from '@cairn/reactivity';
import { Portal, Box } from '@cairn/primitives';

export interface ModalProps {
  open: boolean | Accessor<boolean>;
  onClose?: () => void;
  children: Instance;
}

export function Modal(props: ModalProps): Instance {
  const isOpen = (): boolean =>
    typeof props.open === 'function' ? (props.open as Accessor<boolean>)() : props.open;
  const close = (): void => props.onClose?.();

  const inst = Show({
    when: isOpen,
    children: () =>
      Portal({
        children: Box({
          style: {
            width: '100%',
            height: '100%',
            backgroundColor: 'rgba(0,0,0,0.5)',
            alignX: 'center',
            alignY: 'center',
          },
          focusable: true,
          onClick: () => close(),
          onKeyDown: (e) => { if (e.key === 'Escape') close(); },
          children: Box({
            onClick: (e) => { e.stopPropagation?.(); },
            children: props.children,
          }),
        }),
      }),
  }) as unknown as Instance;
  inst.debugName = 'Modal';
  return inst;
}
