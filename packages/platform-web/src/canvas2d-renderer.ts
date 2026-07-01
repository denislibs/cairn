import type { Rect, Renderer, Shadow, FillStyle, StrokeStyle, Gradient } from '@cairn/host';
import type { CanvasSurface } from './canvas-surface';

export class Canvas2DRenderer implements Renderer {
  private ctx: CanvasRenderingContext2D;
  private logicalWidth = 0;
  private logicalHeight = 0;

  constructor(private surface: CanvasSurface) {
    this.ctx = surface.context;
  }

  // Size the backing store to logical*dpr and draw in logical coordinates.
  resize(logicalWidth: number, logicalHeight: number, dpr: number): void {
    this.logicalWidth = logicalWidth;
    this.logicalHeight = logicalHeight;
    this.surface.setBackingSize(Math.round(logicalWidth * dpr), Math.round(logicalHeight * dpr));
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
  clipRect(rect: Rect): void {
    this.ctx.beginPath();
    this.ctx.rect(rect.x, rect.y, rect.width, rect.height);
    this.ctx.clip();
  }
  setShadow(shadow: Shadow | null): void {
    if (shadow) {
      this.ctx.shadowColor = shadow.color;
      this.ctx.shadowBlur = shadow.blur;
      this.ctx.shadowOffsetX = shadow.offsetX;
      this.ctx.shadowOffsetY = shadow.offsetY;
    } else {
      this.ctx.shadowColor = 'transparent';
      this.ctx.shadowBlur = 0;
      this.ctx.shadowOffsetX = 0;
      this.ctx.shadowOffsetY = 0;
    }
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

  fillRoundRect(): void {}
  strokeRoundRect(): void {}
  fillPath(): void {}
  strokePath(): void {}
  drawText(): void {}
  measureText(): { width: number } {
    return { width: 0 };
  }
  drawImage(): void {}
}
