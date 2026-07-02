// Geometry and style value types. Plain data, no DOM.

export interface Point {
  x: number;
  y: number;
}

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export type Radii = number | { tl: number; tr: number; br: number; bl: number };

export type Color = string; // CSS color string for v1

export interface GradientStop {
  offset: number;
  color: Color;
}

export type Gradient =
  | { kind: 'linear'; from: Point; to: Point; stops: GradientStop[] }
  | { kind: 'radial'; center: Point; radius: number; stops: GradientStop[] };

// If both `gradient` and `color` are set, `gradient` takes precedence.
// If neither is set, renderers default to opaque black.
export interface FillStyle {
  color?: Color;
  gradient?: Gradient;
}

// If both `gradient` and `color` are set, `gradient` takes precedence.
// If neither is set, renderers default to opaque black; `width` defaults to 1.
export interface StrokeStyle {
  color?: Color;
  gradient?: Gradient;
  width?: number;
}

export interface Shadow {
  color: Color;
  blur: number;
  offsetX: number;
  offsetY: number;
}

export interface TextStyle {
  font: string; // CSS font shorthand, e.g. "16px sans-serif"
  color?: Color;
  align?: 'left' | 'center' | 'right';
  baseline?: 'top' | 'middle' | 'alphabetic' | 'bottom';
}

export interface TextMeasurement {
  width: number;
}

// Opaque image handle — keeps @cairn/host DOM-free. DOM image sources
// (HTMLImageElement, ImageBitmap, HTMLCanvasElement) structurally satisfy this.
export interface ImageHandle {
  readonly width: number;
  readonly height: number;
}
