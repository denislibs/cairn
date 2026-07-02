import type { EdgeInsets, Justify, Align } from '@cairn/layout';

// Fixed precedence: later states override earlier ones (disabled wins).
// STATE_ORDER is the single source of truth; StateName is derived from it so the two
// can never drift out of sync. Frozen so it cannot be mutated at runtime.
export const STATE_ORDER = Object.freeze([
  'hover',
  'focus',
  'active',
  'pressed',
  'disabled',
] as const);

export type StateName = (typeof STATE_ORDER)[number];

export interface BaseStyle {
  // layout
  width?: number;
  height?: number;
  padding?: number | Partial<EdgeInsets>;
  gap?: number;
  justify?: Justify;
  align?: Align;
  // paint
  backgroundColor?: string;
  borderRadius?: number;
  border?: { width: number; color: string };
  alignX?: 'start' | 'center' | 'end';
  alignY?: 'start' | 'center' | 'end';
  color?: string;
  font?: string;
}

export type Style = BaseStyle & Partial<Record<StateName, BaseStyle>>;
