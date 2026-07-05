import type { SnapshotNode } from './protocol';
import { pagePointToCanvas } from './highlight';

function contains(n: SnapshotNode, x: number, y: number): boolean {
  return x >= n.rect.x && x <= n.rect.x + n.rect.w && y >= n.rect.y && y <= n.rect.y + n.rect.h;
}

/** Deepest, top-most (by zIndex then paint order) node containing the point, or null. */
export function hitTest(root: SnapshotNode, x: number, y: number): SnapshotNode | null {
  if (!contains(root, x, y)) return null;
  const ordered = root.children
    .map((c, i) => ({ c, i }))
    .sort((a, b) => a.c.layout.zIndex - b.c.layout.zIndex || a.i - b.i);
  for (let k = ordered.length - 1; k >= 0; k--) {
    const hit = hitTest(ordered[k].c, x, y);
    if (hit) return hit;
  }
  return root;
}

export interface PickCallbacks {
  onHover(id: number | null): void;
  onSelect(id: number): void;
}

/** Wires pointer events on the canvas host element into hit-testing against the latest snapshot. */
export class PickController {
  private active = false;
  private snapshot: SnapshotNode | null = null;
  private readonly onMove = (e: PointerEvent): void => {
    if (!this.snapshot) return;
    const p = pagePointToCanvas(this.canvas, e.clientX, e.clientY, this.viewport());
    const hit = hitTest(this.snapshot, p.x, p.y);
    this.cb.onHover(hit ? hit.id : null);
  };
  private readonly onClick = (e: PointerEvent): void => {
    if (!this.snapshot) return;
    const p = pagePointToCanvas(this.canvas, e.clientX, e.clientY, this.viewport());
    const hit = hitTest(this.snapshot, p.x, p.y);
    if (hit) {
      this.cb.onSelect(hit.id);
      this.stop();
      e.preventDefault();
      e.stopPropagation();
    }
  };

  constructor(
    private canvas: HTMLCanvasElement,
    private viewport: () => { w: number; h: number },
    private cb: PickCallbacks,
  ) {}

  update(snapshot: SnapshotNode | null): void { this.snapshot = snapshot; }

  start(): void {
    if (this.active) return;
    this.active = true;
    this.canvas.addEventListener('pointermove', this.onMove, true);
    this.canvas.addEventListener('pointerdown', this.onClick, true);
  }

  stop(): void {
    if (!this.active) return;
    this.active = false;
    this.canvas.removeEventListener('pointermove', this.onMove, true);
    this.canvas.removeEventListener('pointerdown', this.onClick, true);
    this.cb.onHover(null);
  }
}
