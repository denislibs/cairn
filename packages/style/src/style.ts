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

export interface Shadow {
  color: string; blur: number; offsetX: number; offsetY: number;
}
export type CornerRadius = number | { tl: number; tr: number; br: number; bl: number };
export interface BorderSide { width: number; color: string; style?: 'solid' | 'dashed' | 'dotted' }
export interface LinearGradient { kind: 'linear'; from: { x: number; y: number }; to: { x: number; y: number }; stops: { offset: number; color: string }[] }
export interface RadialGradient { kind: 'radial'; center: { x: number; y: number }; radius: number; stops: { offset: number; color: string }[] }
export type StyleGradient = LinearGradient | RadialGradient;

export interface BaseStyle {
  // layout
  width?: number;
  height?: number;
  minWidth?: number;
  maxWidth?: number;
  minHeight?: number;
  maxHeight?: number;
  left?: number;
  top?: number;
  right?: number;
  bottom?: number;
  inset?: number;
  padding?: number | Partial<EdgeInsets>;
  margin?: number | Partial<EdgeInsets>;
  gap?: number;
  rowGap?: number;
  columnGap?: number;
  justify?: Justify;
  align?: Align;
  alignSelf?: 'start' | 'center' | 'end' | 'stretch';
  flexBasis?: number;
  flexShrink?: number;
  flexWrap?: 'nowrap' | 'wrap';
  zIndex?: number;
  // paint
  backgroundColor?: string;
  borderRadius?: CornerRadius;
  border?: BorderSide;
  borderTop?: BorderSide;
  borderRight?: BorderSide;
  borderBottom?: BorderSide;
  borderLeft?: BorderSide;
  backgroundGradient?: StyleGradient;
  boxShadow?: Shadow;
  opacity?: number;
  textShadow?: Shadow;
  textAlign?: 'left' | 'center' | 'right';
  lineHeight?: number;
  alignX?: 'start' | 'center' | 'end';
  alignY?: 'start' | 'center' | 'end';
  aspectRatio?: number;
  color?: string;
  font?: string;
}

export type Style = BaseStyle & Partial<Record<StateName, BaseStyle>>;
