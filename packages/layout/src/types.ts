import type { TextStyle, TextMeasurement } from '@cairn/host';

export interface EdgeInsets {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export interface Constraints {
  minW: number;
  maxW: number;
  minH: number;
  maxH: number;
}

export interface Size {
  w: number;
  h: number;
}

export interface LayoutContext {
  measureText(text: string, style: TextStyle): TextMeasurement;
  viewport?: { w: number; h: number };
  rootFontSize?: number;
}

export function clamp(value: number, min: number, max: number): number {
  return value < min ? min : value > max ? max : value;
}

// Resolve one axis (min,max) given incoming constraints and optional sizing props.
// Precedence: `exact` (an explicit width/height) wins and pins both ends, IGNORING
// `min`/`max`. When there is no `exact`, `min`/`max` tighten the range. Everything is
// finally clamped to the incoming [cMin, cMax].
export function resolveAxis(
  cMin: number,
  cMax: number,
  exact?: number,
  min?: number,
  max?: number,
): [number, number] {
  let lo = exact ?? min ?? cMin;
  let hi = exact ?? max ?? cMax;
  lo = clamp(lo, cMin, cMax);
  hi = clamp(hi, cMin, cMax);
  if (lo > hi) lo = hi;
  return [lo, hi];
}
