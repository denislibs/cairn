import { createSignal, createEffect, createMemo, createRoot, onCleanup, untrack } from '@cairn/reactivity';
import { BoxNode } from '@cairn/layout';
import { type Instance, scheduleFrame, animate } from '@cairn/runtime';
import type { BaseStyle } from '@cairn/style';
import { Box } from './box';

export interface PresenceProps {
  when: () => unknown;
  children: () => Instance;
  from?: BaseStyle;
  duration?: number;
  easing?: any;
  spring?: { stiffness?: number; damping?: number; mass?: number };
}

export function Presence(props: PresenceProps): Instance {
  const layout = new BoxNode({});
  const instance: Instance = { layout, children: [], paintSelf() {} };
  const from = props.from ?? { opacity: 0 };
  const dur = props.duration ?? (props.spring ? 500 : 250);
  const transition = props.spring
    ? { spring: props.spring }
    : { duration: dur, easing: props.easing };

  const [hidden, setHidden] = createSignal(true);
  let scope: (() => void) | null = null;
  let mounted = false;
  let unmountCancel: (() => void) | null = null;

  const setChild = (child: Instance | null): void => {
    instance.children = child ? [child] : [];
    layout.children = child ? [child.layout] : [];
    scheduleFrame();
  };

  const cond = createMemo(() => !!props.when());

  createEffect(() => {
    const show = cond();
    if (show) {
      if (unmountCancel) {
        unmountCancel();
        unmountCancel = null;
      }
      if (!mounted) {
        setHidden(true);
        untrack(() =>
          createRoot((d) => {
            const built = props.children();
            const wrapper = Box({
              style: () => ({ ...(hidden() ? from : {}), transition } as any),
              children: built,
            });
            scope = d;
            setChild(wrapper);
          }),
        );
        mounted = true;
      }
      setHidden(false); // enter: from → present
    } else {
      if (mounted && !unmountCancel) {
        setHidden(true); // exit: present → from
        unmountCancel = animate({
          from: 0,
          to: 1,
          duration: dur,
          onUpdate: () => {},
          onDone: () => {
            unmountCancel = null;
            scope?.();
            scope = null;
            setChild(null);
            mounted = false;
          },
        });
      }
    }
  });

  onCleanup(() => {
    unmountCancel?.();
    scope?.();
  });

  return instance;
}
