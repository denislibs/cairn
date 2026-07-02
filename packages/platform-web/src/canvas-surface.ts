// Decouples the renderer from the DOM canvas so it can be unit-tested with a fake.
export interface CanvasSurface {
  readonly context: CanvasRenderingContext2D;
  setBackingSize(widthPx: number, heightPx: number): void;
}

export class HtmlCanvasSurface implements CanvasSurface {
  readonly context: CanvasRenderingContext2D;

  constructor(private canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('[cairn] 2D canvas context is not available');
    this.context = ctx;
  }

  setBackingSize(widthPx: number, heightPx: number): void {
    this.canvas.width = widthPx;
    this.canvas.height = heightPx;
  }
}
