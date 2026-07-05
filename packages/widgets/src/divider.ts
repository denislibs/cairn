import type { Instance } from '@cairn/runtime';
import { Box } from '@cairn/primitives';

export interface DividerProps {
  orientation?: 'horizontal' | 'vertical';
  thickness?: number;
  color?: string;
  length?: number; // optional fixed length on the main axis
}

export function Divider(props: DividerProps = {}): Instance {
  const t = props.thickness ?? 1;
  const color = props.color ?? '#e5e7eb';
  const horizontal = (props.orientation ?? 'horizontal') === 'horizontal';
  const inst = Box({
    style: horizontal
      ? { height: t, width: props.length, backgroundColor: color }
      : { width: t, height: props.length, backgroundColor: color },
  });
  inst.debugName = 'Divider';
  return inst;
}
