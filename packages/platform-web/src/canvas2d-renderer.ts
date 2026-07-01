import type { Rect, Renderer } from '@cairn/host';
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
  setShadow(): void {}
  fillRect(): void {}
  strokeRect(): void {}
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
