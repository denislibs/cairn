import type { Instance, SemanticsNode } from '@cairn/runtime';
import { createEffect, type Accessor } from '@cairn/reactivity';
import { Box, applyLayoutChildProps, mergeStyles, type StyleInput, type LayoutChildProps } from '@cairn/primitives';
import { useWidgetTheme } from './theme';

export interface ProgressProps extends LayoutChildProps {
  value?: number | Accessor<number>;
  max?: number;
  indeterminate?: boolean;
  size?: number;
  color?: string;
  style?: StyleInput;
}

export function Progress(props: ProgressProps): Instance {
  const t = useWidgetTheme();

  const resolvedMax = props.max ?? 100;
  const resolvedSize = props.size ?? 6;
  const resolvedColor = t.colors[props.color ?? 'primary'] ?? t.colors.primary;

  // Read the current numeric value (0 when undefined/indeterminate)
  const readValue = (): number => {
    if (props.indeterminate || props.value === undefined) return 0;
    const v = props.value;
    return typeof v === 'function' ? (v as Accessor<number>)() : (v as number);
  };

  // Whether value is defined (not indeterminate and not undefined)
  const hasDeterminateValue = !props.indeterminate && props.value !== undefined;

  // Percentage string for fill width (integer, clamped [0, 100])
  const fillPct = (): string => {
    const pct = Math.round((readValue() / resolvedMax) * 100);
    const clamped = Math.max(0, Math.min(100, pct));
    return `${clamped}%`;
  };

  // ─── Semantics ────────────────────────────────────────────────────────────
  const semantics: SemanticsNode = {
    role: 'progressbar',
    min: 0,
    max: resolvedMax,
    now: hasDeterminateValue ? readValue() : undefined,
  };

  // Reactively sync semantics.now when value is an accessor
  if (hasDeterminateValue) {
    createEffect(() => {
      semantics.now = readValue();
    });
  }

  // ─── Fill box (width tracks value reactively) ─────────────────────────────
  const fill = Box({
    style: () => ({
      width: fillPct() as any,
      height: resolvedSize,
      borderRadius: resolvedSize / 2,
      backgroundColor: resolvedColor,
    }),
  });

  // ─── Track box (contains fill) ────────────────────────────────────────────
  const trackStyle: StyleInput = mergeStyles(
    {
      width: '100%' as any,
      height: resolvedSize,
      borderRadius: resolvedSize / 2,
      backgroundColor: t.colors.trackOff,
    },
    props.style,
  );

  const track = Box({
    style: trackStyle,
    children: fill,
  });

  track.semantics = semantics;
  applyLayoutChildProps(track, props);
  return track;
}
