import type { Instance } from '@cairn/runtime';
import type { Renderer } from '@cairn/host';
import { createPath } from '@cairn/host';
import { createEffect, type Accessor } from '@cairn/reactivity';
import { useTheme } from '@cairn/style';
import { Box, mergeStyles, type StyleInput } from '@cairn/primitives';
import { BoxNode } from '@cairn/layout';
import type { MaterialTheme } from './theme';
import type { MaterialColor } from './button';

// ── Shared helpers ────────────────────────────────────────────────────────────

/** Resolve MaterialColor to palette[color].main, falling back to primary. */
function resolveColor(t: MaterialTheme, color: MaterialColor = 'primary'): string {
  return t.palette[color]?.main ?? t.palette.primary.main;
}

/** Read a possibly-accessor numeric value. */
function readVal(v: number | Accessor<number> | undefined): number {
  if (v === undefined) return 0;
  return typeof v === 'function' ? (v as Accessor<number>)() : (v as number);
}

// ── LinearProgress ────────────────────────────────────────────────────────────

export interface LinearProgressProps {
  value?: number | Accessor<number>;
  max?: number;
  variant?: 'determinate' | 'indeterminate';
  color?: MaterialColor;
  style?: StyleInput;
}

/**
 * Material LinearProgress — a Box track containing a Box fill bar.
 * Uses palette[color].main for the fill bar and palette[color].light for the track.
 * Inherits progressbar semantics (role/min/max/now) on the track node.
 */
export function LinearProgress(props: LinearProgressProps): Instance {
  const t = useTheme() as unknown as MaterialTheme;
  const max = props.max ?? 100;
  const indeterminate = props.variant === 'indeterminate';
  const barColor = resolveColor(t, props.color);
  const trackBg = t.palette[props.color ?? 'primary']?.light ?? '#e0e0e0';
  const trackHeight = 4;

  // Fill percentage string, clamped [0, 100]. Indeterminate shows a static 25%.
  const pct = (): string => {
    if (indeterminate) return '25%';
    const raw = (readVal(props.value) / max) * 100;
    return `${Math.max(0, Math.min(100, Math.round(raw)))}%`;
  };

  // Semantics — set on the track node
  const hasDeterminate = !indeterminate && props.value !== undefined;
  const semantics = {
    role: 'progressbar' as const,
    min: 0,
    max,
    now: hasDeterminate ? readVal(props.value) : undefined,
  };
  if (hasDeterminate) {
    createEffect(() => {
      semantics.now = readVal(props.value);
    });
  }

  // Fill bar — width is reactive
  const fill = Box({
    style: () => ({
      width: pct() as any,
      height: trackHeight,
      borderRadius: trackHeight / 2,
      backgroundColor: barColor,
    }),
  });

  // Track — full width, contains the fill
  const track = Box({
    style: mergeStyles(
      {
        width: '100%' as any,
        height: trackHeight,
        borderRadius: trackHeight / 2,
        backgroundColor: trackBg,
        overflow: 'hidden' as const,
      },
      props.style,
    ),
    children: fill,
  });

  track.semantics = semantics;
  return track;
}

// ── CircularProgress ──────────────────────────────────────────────────────────

export interface CircularProgressProps {
  value?: number | Accessor<number>;
  max?: number;
  size?: number;
  thickness?: number;
  variant?: 'determinate' | 'indeterminate';
  color?: MaterialColor;
}

/**
 * Material CircularProgress — a custom-paint Instance (BoxNode + paintSelf).
 *
 * Arc drawing: uses createPath().arc(cx, cy, r, start, end).build() then
 * r.strokePath(path, { color, width: thickness }) — pure canvas, no DOM.
 *
 * Two strokePath calls per frame:
 *   1. Full track ring (360°) in palette[color].light
 *   2. Progress arc starting at -90° (top), sweeping clockwise by fraction * 2π,
 *      in palette[color].main
 *
 * Indeterminate: renders a static 25% arc. Optional slow rotation via
 * instance.transform can be wired externally; not implemented here per spec.
 */
export function CircularProgress(props: CircularProgressProps): Instance {
  const t = useTheme() as unknown as MaterialTheme;
  const size = props.size ?? 40;
  const thickness = props.thickness ?? 3.6;
  const max = props.max ?? 100;
  const indeterminate = props.variant !== 'determinate';
  const barColor = resolveColor(t, props.color);

  // Track color: lighter shade of the chosen color
  const trackColor = t.palette[props.color ?? 'primary']?.light ?? '#e0e0e0';

  // Semantics — set manually since this is not wrapping the headless Progress
  const hasDeterminate = !indeterminate && props.value !== undefined;
  const semantics = {
    role: 'progressbar' as const,
    min: 0,
    max,
    now: hasDeterminate ? readVal(props.value) : undefined,
  };
  if (hasDeterminate) {
    createEffect(() => {
      semantics.now = readVal(props.value);
    });
  }

  // Progress fraction [0, 1]
  const fraction = (): number => {
    if (indeterminate) return 0.25; // static 25% arc for indeterminate
    const raw = readVal(props.value) / max;
    return Math.max(0, Math.min(1, raw));
  };

  // ── Custom-paint BoxNode instance ─────────────────────────────────────────
  const layout = new BoxNode({ width: size, height: size });

  const inst: Instance = {
    layout,
    children: [],
    semantics,
    paintSelf(r: Renderer) {
      const w = layout.size.w;
      const h = layout.size.h;
      if (w === 0 || h === 0) return;

      const cx = w / 2;
      const cy = h / 2;
      // Radius inset by half the stroke width so strokes stay within bounds
      const radius = Math.max(0, (Math.min(w, h) - thickness) / 2);

      // 1. Full track ring (360°)
      const trackPath = createPath()
        .arc(cx, cy, radius, 0, Math.PI * 2)
        .build();
      r.strokePath(trackPath, { color: trackColor, width: thickness });

      // 2. Progress arc: start at top (-π/2), sweep clockwise by fraction * 2π
      const f = fraction();
      if (f > 0) {
        const startAngle = -Math.PI / 2;
        const endAngle = startAngle + f * Math.PI * 2;
        const arcPath = createPath()
          .arc(cx, cy, radius, startAngle, endAngle)
          .build();
        r.strokePath(arcPath, { color: barColor, width: thickness });
      }
    },
  };

  return inst;
}
