import { type Instance } from '@cairn/runtime';
import { createSignal, type Accessor } from '@cairn/reactivity';
import { Box, Stack } from '@cairn/primitives';

export interface SwitchProps {
  value?: boolean | Accessor<boolean>;
  defaultValue?: boolean;
  onChange?: (v: boolean) => void;
  disabled?: boolean;
}

// Track dimensions
const TRACK_W = 44;
const TRACK_H = 24;
const TRACK_RADIUS = 12;

// Thumb dimensions
const THUMB_SIZE = 20;
const THUMB_RADIUS = 10;
const THUMB_TOP = 2;
const THUMB_LEFT_OFF = 2;
const THUMB_LEFT_ON = 22;

// Colors
const TRACK_COLOR_ON = '#4577e6';
const TRACK_COLOR_OFF = '#6b7280';

export function Switch(props: SwitchProps): Instance {
  const controlled = props.value !== undefined;
  const [internal, setInternal] = createSignal(props.defaultValue ?? false);

  const read = (): boolean =>
    controlled
      ? (typeof props.value === 'function'
          ? (props.value as Accessor<boolean>)()
          : (props.value as boolean))
      : internal();

  const toggle = (): void => {
    if (props.disabled) return;
    const next = !read();
    if (!controlled) setInternal(next);
    props.onChange?.(next);
  };

  // The thumb is a direct child of the Stack so the Stack reads its left/top.
  // Position is driven reactively through `style` (a function style re-runs on
  // read() change, and Box forwards left/top from style onto the layout node).
  const thumb = Box({
    style: () => ({
      width: THUMB_SIZE,
      height: THUMB_SIZE,
      borderRadius: THUMB_RADIUS,
      backgroundColor: '#ffffff',
      left: read() ? THUMB_LEFT_ON : THUMB_LEFT_OFF,
      top: THUMB_TOP,
    }),
  });

  // Reactive track color via a theme-function style. The style callback re-runs
  // whenever read() changes because Box binds the resolved style reactively.
  return Box({
    style: () => ({
      width: TRACK_W,
      height: TRACK_H,
      borderRadius: TRACK_RADIUS,
      backgroundColor: read() ? TRACK_COLOR_ON : TRACK_COLOR_OFF,
    }),
    focusable: true,
    onClick: () => toggle(),
    onKeyDown: (e) => { if (e.key === ' ' || e.key === 'Enter') toggle(); },
    children: Stack({ children: thumb }),
  });
}
