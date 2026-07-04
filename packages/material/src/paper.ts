import type { Instance } from '@cairn/runtime';
import { useTheme } from '@cairn/style';
import { Box, Column, Text, mergeStyles } from '@cairn/primitives';
import type { MaterialTheme } from './theme';
import type { StyleInput } from '@cairn/primitives';

export interface PaperProps {
  children?: Instance | Instance[] | string;
  elevation?: number;
  square?: boolean;
  style?: StyleInput;
}

export function Paper(props: PaperProps): Instance {
  const t = useTheme() as unknown as MaterialTheme;

  const elevation = props.elevation ?? 1;
  const clampedElevation = Math.max(0, Math.min(elevation, t.elevation.length - 1));
  const shadow = t.elevation[clampedElevation];

  const baseStyle: StyleInput = {
    backgroundColor: t.palette.background.paper,
    borderRadius: props.square ? 0 : t.shape.borderRadius,
    boxShadow: shadow,
  };

  const resolvedStyle = mergeStyles(baseStyle, props.style);

  // Resolve children: string → Text, array → Column, single instance → pass through
  let child: Instance;
  const raw = props.children;
  if (raw === undefined || raw === null) {
    // no children — render an empty Box
    child = undefined as unknown as Instance;
  } else if (typeof raw === 'string') {
    child = Text({ children: raw });
  } else if (Array.isArray(raw)) {
    child = Column({ children: raw as Instance[] });
  } else {
    child = raw as Instance;
  }

  const inst = Box({
    style: resolvedStyle,
    children: child,
  }) as any;

  // Material semantics: Paper is a grouping surface
  inst.role = 'group';

  return inst as Instance;
}
