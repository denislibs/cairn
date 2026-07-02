import type {
  InputSource,
  PointerInput,
  PointerInputType,
  WheelInput,
} from '@cairn/host';

// Attaches DOM pointer/wheel listeners to a canvas and normalizes them into the
// DOM-free PointerInput/WheelInput contract. Coordinates are converted to logical
// px relative to the canvas top-left via getBoundingClientRect().
export class WebInputSource implements InputSource {
  private pointerCbs = new Set<(e: PointerInput) => void>();
  private wheelCbs = new Set<(e: WheelInput) => void>();

  constructor(private canvas: HTMLCanvasElement) {
    canvas.addEventListener('pointerdown', this.down);
    canvas.addEventListener('pointermove', this.move);
    canvas.addEventListener('pointerup', this.up);
    canvas.addEventListener('wheel', this.wheel);
    canvas.addEventListener('pointerleave', this.leave);
  }

  onPointer(cb: (e: PointerInput) => void): () => void {
    this.pointerCbs.add(cb);
    return () => this.pointerCbs.delete(cb);
  }

  onWheel(cb: (e: WheelInput) => void): () => void {
    this.wheelCbs.add(cb);
    return () => this.wheelCbs.delete(cb);
  }

  // Placeholder; real keyboard wiring added in a later task.
  onKey(): () => void {
    return () => {};
  }

  dispose(): void {
    this.canvas.removeEventListener('pointerdown', this.down);
    this.canvas.removeEventListener('pointermove', this.move);
    this.canvas.removeEventListener('pointerup', this.up);
    this.canvas.removeEventListener('wheel', this.wheel);
    this.canvas.removeEventListener('pointerleave', this.leave);
  }

  private emitPointer(type: PointerInputType, ev: PointerEvent): void {
    const rect = this.canvas.getBoundingClientRect();
    const input: PointerInput = {
      type,
      x: ev.clientX - rect.left,
      y: ev.clientY - rect.top,
      button: ev.button,
      pointerType: (ev.pointerType as PointerInput['pointerType']) || 'mouse',
    };
    for (const cb of this.pointerCbs) cb(input);
  }

  private down = (ev: PointerEvent) => this.emitPointer('pointerdown', ev);
  private move = (ev: PointerEvent) => this.emitPointer('pointermove', ev);
  private up = (ev: PointerEvent) => this.emitPointer('pointerup', ev);

  private leave = (ev: PointerEvent) => {
    const input: PointerInput = {
      type: 'pointermove',
      x: -1,
      y: -1,
      button: 0,
      pointerType: (ev.pointerType as PointerInput['pointerType']) || 'mouse',
    };
    for (const cb of this.pointerCbs) cb(input);
  };

  private wheel = (ev: WheelEvent) => {
    const rect = this.canvas.getBoundingClientRect();
    const input: WheelInput = {
      x: ev.clientX - rect.left,
      y: ev.clientY - rect.top,
      deltaX: ev.deltaX,
      deltaY: ev.deltaY,
    };
    for (const cb of this.wheelCbs) cb(input);
  };
}
