import type { TextStyle, TextMeasurement } from '@cairn/host';

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
}

export function clamp(value: number, min: number, max: number): number {
  return value < min ? min : value > max ? max : value;
}

// Resolve one axis (min,max) given incoming constraints and optional sizing props.
// exact pins both ends; min/max tighten. Everything is clamped to the incoming range.
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
