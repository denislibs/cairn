import type { Instance } from '@cairn/runtime';
import { Box } from './box';

export interface SpacerProps {
  size?: number; // fixed px on both axes (a fixed gap); when omitted, grows via flex
  flex?: number; // grow factor when no size (default 1)
}

// A layout spacer. With `size`, a fixed square gap; otherwise a flex-grow filler that
// eats free space on the parent's main axis (works in both Row and Column).
export function Spacer(props: SpacerProps = {}): Instance {
  if (props.size !== undefined) {
    return Box({ style: { width: props.size, height: props.size } });
  }
  return Box({ flex: props.flex ?? 1 });
}
