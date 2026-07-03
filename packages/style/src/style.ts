import type { EdgeInsets, Justify, Align, TrackSize, Length } from '@cairn/layout';

/** Structural alias for ImageHandle from @cairn/host — kept local to avoid a cross-package dep. */
export interface ImageHandle { readonly width: number; readonly height: number; }

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
  spread?: number;
  inset?: boolean;
}
export interface Transform {
  translateX?: number; translateY?: number;
  scale?: number; scaleX?: number; scaleY?: number;
  rotate?: number;   // degrees
  skewX?: number; skewY?: number; // degrees
}
export type CornerRadius = number | { tl: number; tr: number; br: number; bl: number };
export interface BorderSide { width: number; color: string; style?: 'solid' | 'dashed' | 'dotted' }
export interface LinearGradient { kind: 'linear'; from: { x: number; y: number }; to: { x: number; y: number }; stops: { offset: number; color: string }[] }
export interface RadialGradient { kind: 'radial'; center: { x: number; y: number }; radius: number; stops: { offset: number; color: string }[] }
export type StyleGradient = LinearGradient | RadialGradient;

export interface BaseStyle {
  // layout
  width?: Length;
  height?: Length;
  minWidth?: Length;
  maxWidth?: Length;
  minHeight?: Length;
  maxHeight?: Length;
  left?: number;
  top?: number;
  right?: number;
  bottom?: number;
  inset?: number;
  padding?: Length | Partial<Record<'top' | 'right' | 'bottom' | 'left', Length>>;
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
  gridTemplateColumns?: string | TrackSize[];
  gridTemplateRows?: string | TrackSize[];
  gridTemplateAreas?: string[]; // each string = a row of space-separated area names
  justifyItems?: 'start' | 'center' | 'end' | 'stretch';
  alignItems?: 'start' | 'center' | 'end' | 'stretch';
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
  boxShadow?: Shadow | Shadow[];
  elevation?: number;
  opacity?: number;
  textShadow?: Shadow;
  textAlign?: 'left' | 'center' | 'right';
  lineHeight?: number;
  alignX?: 'start' | 'center' | 'end';
  alignY?: 'start' | 'center' | 'end';
  aspectRatio?: number;
  color?: string;
  font?: string;
  fontFamily?: string;
  fontSize?: number;
  fontWeight?: number | 'normal' | 'bold';
  fontStyle?: 'normal' | 'italic';
  letterSpacing?: number;
  textTransform?: 'none' | 'uppercase' | 'lowercase' | 'capitalize';
  overflow?: 'visible' | 'hidden' | 'clip';
  maxLines?: number;
  ellipsis?: string;
  textDecoration?: 'none' | 'underline' | 'line-through';
  transform?: Transform;
  transformOrigin?: { x: number; y: number };
  filter?: string;
  backdropFilter?: string;
  backgroundImage?: ImageHandle;
  backgroundSize?: 'cover' | 'contain' | 'fill';
  cursor?: string;
  pointerEvents?: 'auto' | 'none';
  userSelect?: 'auto' | 'none' | 'text';
}

export type Style = BaseStyle & Partial<Record<StateName, BaseStyle>>;
