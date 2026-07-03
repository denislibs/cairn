import type {
  Rect,
  Renderer,
  Shadow,
  FillStyle,
  StrokeStyle,
  Gradient,
  Radii,
  Path,
  Point,
  TextStyle,
  TextMeasurement,
  ImageHandle,
} from '@cairn/host';
import type { CanvasSurface } from './canvas-surface';

export class Canvas2DRenderer implements Renderer {
  private ctx: CanvasRenderingContext2D;
  private logicalWidth = 0;
  private logicalHeight = 0;
  private lastBackingW = -1;
  private lastBackingH = -1;

  constructor(private surface: CanvasSurface) {
    this.ctx = surface.context;
  }

  // Size the backing store to logical*dpr and draw in logical coordinates.
  // Idempotent: setting canvas.width/height CLEARS and resets the context, so we
  // only touch the backing store when it actually changed. This makes it safe to
  // call every frame as a self-healing size sync (crisp text after zoom / DPR change).
  resize(logicalWidth: number, logicalHeight: number, dpr: number): void {
    this.logicalWidth = logicalWidth;
    this.logicalHeight = logicalHeight;
    const backingW = Math.round(logicalWidth * dpr);
    const backingH = Math.round(logicalHeight * dpr);
    if (backingW === this.lastBackingW && backingH === this.lastBackingH) {
      // Backing already correct — just ensure the base transform is the current dpr
      // (cheap; guards against any external context-state reset).
      this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      return;
    }
    this.lastBackingW = backingW;
    this.lastBackingH = backingH;
    this.surface.setBackingSize(backingW, backingH);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  beginFrame(): void {
    this.ctx.save();
  }

  endFrame(): void {
    this.ctx.restore();
  }

  clear(rect?: Rect): void {
    if (rect) {
      this.ctx.clearRect(rect.x, rect.y, rect.width, rect.height);
    } else {
      this.ctx.clearRect(0, 0, this.logicalWidth, this.logicalHeight);
    }
  }

  // ---- the rest of the Renderer surface is implemented in later tasks ----
  save(): void {
    this.ctx.save();
  }
  restore(): void {
    this.ctx.restore();
  }
  translate(x: number, y: number): void {
    this.ctx.translate(x, y);
  }
  scale(x: number, y: number): void {
    this.ctx.scale(x, y);
  }
  rotate(radians: number): void {
    this.ctx.rotate(radians);
  }
  transform(a: number, b: number, c: number, d: number, e: number, f: number): void {
    this.ctx.transform(a, b, c, d, e, f);
  }
  setFilter(filter: string | null): void {
    if ('filter' in this.ctx) (this.ctx as any).filter = filter ?? 'none';
  }
  clipRect(rect: Rect): void {
    this.ctx.beginPath();
    this.ctx.rect(rect.x, rect.y, rect.width, rect.height);
    this.ctx.clip();
  }
  clipRoundRect(rect: Rect, radii: Radii): void {
    this.ctx.beginPath();
    this.ctx.roundRect(rect.x, rect.y, rect.width, rect.height, normalizeRadii(radii));
    this.ctx.clip();
  }
  setShadow(shadow: Shadow | null): void {
    if (shadow) {
      this.ctx.shadowColor = shadow.color;
      this.ctx.shadowBlur = shadow.blur;
      this.ctx.shadowOffsetX = shadow.offsetX;
      this.ctx.shadowOffsetY = shadow.offsetY;
    } else {
      // rgba(0,0,0,0) is the canvas spec's initial shadowColor — unambiguous
      // and free of the cross-browser variance some engines have with 'transparent'.
      this.ctx.shadowColor = 'rgba(0,0,0,0)';
      this.ctx.shadowBlur = 0;
      this.ctx.shadowOffsetX = 0;
      this.ctx.shadowOffsetY = 0;
    }
  }

  setGlobalAlpha(alpha: number): void {
    this.ctx.globalAlpha = alpha;
  }
  setLineDash(segments: number[]): void {
    this.ctx.setLineDash(segments);
  }

  fillRect(rect: Rect, style: FillStyle): void {
    this.ctx.fillStyle = this.resolveFill(style);
    this.ctx.fillRect(rect.x, rect.y, rect.width, rect.height);
  }

  strokeRect(rect: Rect, style: StrokeStyle): void {
    this.applyStroke(style);
    this.ctx.strokeRect(rect.x, rect.y, rect.width, rect.height);
  }

  private resolveFill(style: FillStyle): string | CanvasGradient {
    if (style.gradient) return this.buildGradient(style.gradient);
    return style.color ?? '#000';
  }

  private applyStroke(style: StrokeStyle): void {
    this.ctx.strokeStyle = style.gradient
      ? this.buildGradient(style.gradient)
      : style.color ?? '#000';
    this.ctx.lineWidth = style.width ?? 1;
  }

  private buildGradient(g: Gradient): CanvasGradient {
    let gradient: CanvasGradient;
    if (g.kind === 'linear') {
      gradient = this.ctx.createLinearGradient(g.from.x, g.from.y, g.to.x, g.to.y);
    } else {
      gradient = this.ctx.createRadialGradient(
        g.center.x,
        g.center.y,
        0,
        g.center.x,
        g.center.y,
        g.radius,
      );
    }
    for (const stop of g.stops) gradient.addColorStop(stop.offset, stop.color);
    return gradient;
  }

  fillRoundRect(rect: Rect, radii: Radii, style: FillStyle): void {
    this.ctx.fillStyle = this.resolveFill(style);
    this.ctx.beginPath();
    this.ctx.roundRect(rect.x, rect.y, rect.width, rect.height, normalizeRadii(radii));
    this.ctx.fill();
  }

  strokeRoundRect(rect: Rect, radii: Radii, style: StrokeStyle): void {
    this.applyStroke(style);
    this.ctx.beginPath();
    this.ctx.roundRect(rect.x, rect.y, rect.width, rect.height, normalizeRadii(radii));
    this.ctx.stroke();
  }

  fillPath(path: Path, style: FillStyle): void {
    this.ctx.fillStyle = this.resolveFill(style);
    this.tracePath(path);
    this.ctx.fill();
  }

  strokePath(path: Path, style: StrokeStyle): void {
    this.applyStroke(style);
    this.tracePath(path);
    this.ctx.stroke();
  }

  drawText(text: string, pos: Point, style: TextStyle): void {
    const ls = style.letterSpacing;
    const canLS = 'letterSpacing' in this.ctx;
    const prevLS = canLS ? (this.ctx as any).letterSpacing : undefined;
    if (canLS && ls != null) (this.ctx as any).letterSpacing = `${ls}px`;
    this.ctx.font = style.font;
    this.ctx.fillStyle = style.color ?? '#000';
    this.ctx.textAlign = style.align ?? 'left';
    this.ctx.textBaseline = style.baseline ?? 'alphabetic';
    this.ctx.fillText(text, pos.x, pos.y);
    if (canLS && ls != null) (this.ctx as any).letterSpacing = prevLS;
  }

  measureText(text: string, style: TextStyle): TextMeasurement {
    const ls = style.letterSpacing;
    const canLS = 'letterSpacing' in this.ctx;
    const prevLS = canLS ? (this.ctx as any).letterSpacing : undefined;
    if (canLS && ls != null) (this.ctx as any).letterSpacing = `${ls}px`;
    this.ctx.font = style.font;
    const width = this.ctx.measureText(text).width;
    if (canLS && ls != null) (this.ctx as any).letterSpacing = prevLS;
    return { width };
  }

  drawImage(image: ImageHandle, dest: Rect, src?: Rect): void {
    const img = image as unknown as CanvasImageSource;
    if (src) {
      this.ctx.drawImage(
        img,
        src.x,
        src.y,
        src.width,
        src.height,
        dest.x,
        dest.y,
        dest.width,
        dest.height,
      );
    } else {
      this.ctx.drawImage(img, dest.x, dest.y, dest.width, dest.height);
    }
  }

  private tracePath(path: Path): void {
    this.ctx.beginPath();
    for (const cmd of path.commands) {
      switch (cmd.type) {
        case 'moveTo':
          this.ctx.moveTo(cmd.x, cmd.y);
          break;
        case 'lineTo':
          this.ctx.lineTo(cmd.x, cmd.y);
          break;
        case 'arc':
          this.ctx.arc(cmd.cx, cmd.cy, cmd.r, cmd.start, cmd.end);
          break;
        case 'quadTo':
          this.ctx.quadraticCurveTo(cmd.cx, cmd.cy, cmd.x, cmd.y);
          break;
        case 'cubicTo':
          this.ctx.bezierCurveTo(cmd.c1x, cmd.c1y, cmd.c2x, cmd.c2y, cmd.x, cmd.y);
          break;
        case 'close':
          this.ctx.closePath();
          break;
      }
    }
  }
}

function normalizeRadii(r: Radii): [number, number, number, number] {
  return typeof r === 'number' ? [r, r, r, r] : [r.tl, r.tr, r.br, r.bl];
}
