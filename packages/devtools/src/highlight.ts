import type { Rect } from './protocol';

export function canvasRectToPage(
  canvas: HTMLCanvasElement,
  rect: Rect,
  viewport: { w: number; h: number },
): Rect {
  const b = canvas.getBoundingClientRect();
  const sx = viewport.w ? b.width / viewport.w : 1;
  const sy = viewport.h ? b.height / viewport.h : 1;
  return { x: b.left + rect.x * sx, y: b.top + rect.y * sy, w: rect.w * sx, h: rect.h * sy };
}

export function pagePointToCanvas(
  canvas: HTMLCanvasElement,
  clientX: number,
  clientY: number,
  viewport: { w: number; h: number },
): { x: number; y: number } {
  const b = canvas.getBoundingClientRect();
  const sx = b.width ? viewport.w / b.width : 1;
  const sy = b.height ? viewport.h / b.height : 1;
  return { x: (clientX - b.left) * sx, y: (clientY - b.top) * sy };
}

/** A fixed-position DOM overlay drawn over the canvas to outline a node. */
export class Highlighter {
  private el: HTMLDivElement | null = null;

  constructor(private canvas: HTMLCanvasElement) {}

  private ensure(): HTMLDivElement {
    if (this.el) return this.el;
    const el = document.createElement('div');
    el.style.cssText = [
      'position:fixed', 'pointer-events:none', 'z-index:2147483646',
      'background:rgba(80,140,255,0.25)', 'border:1px solid rgba(80,140,255,0.9)',
      'box-sizing:border-box', 'display:none',
    ].join(';');
    document.body.appendChild(el);
    this.el = el;
    return el;
  }

  show(rect: Rect, viewport: { w: number; h: number }): void {
    const el = this.ensure();
    const p = canvasRectToPage(this.canvas, rect, viewport);
    el.style.left = `${p.x}px`;
    el.style.top = `${p.y}px`;
    el.style.width = `${p.w}px`;
    el.style.height = `${p.h}px`;
    el.style.display = 'block';
  }

  hide(): void {
    if (this.el) this.el.style.display = 'none';
  }

  dispose(): void {
    if (this.el) { this.el.remove(); this.el = null; }
  }
}
