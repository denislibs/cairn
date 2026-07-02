import type {
  Rect,
  Radii,
  FillStyle,
  StrokeStyle,
  Shadow,
  TextStyle,
  TextMeasurement,
  Point,
  ImageHandle,
} from './types';
import type { Path } from './path';

export interface Renderer {
  // Configure the drawing surface for a logical size at a given device pixel ratio.
  // Backends may reset all context state here, so call it BETWEEN frames — never
  // between beginFrame() and endFrame(). All other coordinates are logical pixels.
  resize(logicalWidth: number, logicalHeight: number, devicePixelRatio: number): void;

  beginFrame(): void;
  endFrame(): void;
  clear(rect?: Rect): void;

  save(): void;
  restore(): void;
  translate(x: number, y: number): void;
  scale(x: number, y: number): void;
  // Intersects the current clip region (does not replace it). Wrap in
  // save()/restore() to scope a clip to a subtree.
  clipRect(rect: Rect): void;
  setShadow(shadow: Shadow | null): void;

  fillRect(rect: Rect, style: FillStyle): void;
  strokeRect(rect: Rect, style: StrokeStyle): void;
  fillRoundRect(rect: Rect, radii: Radii, style: FillStyle): void;
  strokeRoundRect(rect: Rect, radii: Radii, style: StrokeStyle): void;
  fillPath(path: Path, style: FillStyle): void;
  strokePath(path: Path, style: StrokeStyle): void;
  drawText(text: string, pos: Point, style: TextStyle): void;
  measureText(text: string, style: TextStyle): TextMeasurement;
  drawImage(image: ImageHandle, dest: Rect, src?: Rect): void;
}
