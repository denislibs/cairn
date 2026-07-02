import type {
  InputSource,
  PointerInput,
  PointerInputType,
  WheelInput,
  KeyboardInput,
  KeyInputType,
} from '@cairn/host';

// Attaches DOM pointer/wheel listeners to a canvas and normalizes them into the
// DOM-free PointerInput/WheelInput contract. Coordinates are converted to logical
// px relative to the canvas top-left via getBoundingClientRect().
//
// Keyboard is listened on a document-level target (window) rather than the canvas,
// and the canvas is intentionally NOT made focusable: that lets the hidden <input>
// text proxy hold DOM focus during editing (a focusable canvas would steal it back
// on the trusted mousedown after a click), while keyboard still reaches the app.
export class WebInputSource implements InputSource {
  private pointerCbs = new Set<(e: PointerInput) => void>();
  private wheelCbs = new Set<(e: WheelInput) => void>();
  private keyCbs = new Set<(e: KeyboardInput) => void>();
  private keyTarget?: EventTarget;

  constructor(private canvas: HTMLCanvasElement, keyTarget?: EventTarget) {
    canvas.addEventListener('pointerdown', this.down);
    canvas.addEventListener('pointermove', this.move);
    canvas.addEventListener('pointerup', this.up);
    canvas.addEventListener('wheel', this.wheel);
    canvas.addEventListener('pointerleave', this.leave);
    // Stop a click on the canvas from moving DOM focus (which would blur the hidden
    // text-input proxy right after we focus it). Keyboard is on the window, so the
    // canvas never needs DOM focus.
    canvas.addEventListener('mousedown', this.blockFocusSteal);
    this.keyTarget = keyTarget ?? (typeof window !== 'undefined' ? window : undefined);
    this.keyTarget?.addEventListener('keydown', this.keydown as EventListener);
    this.keyTarget?.addEventListener('keyup', this.keyup as EventListener);
  }

  onPointer(cb: (e: PointerInput) => void): () => void {
    this.pointerCbs.add(cb);
    return () => this.pointerCbs.delete(cb);
  }

  onWheel(cb: (e: WheelInput) => void): () => void {
    this.wheelCbs.add(cb);
    return () => this.wheelCbs.delete(cb);
  }

  onKey(cb: (e: KeyboardInput) => void): () => void {
    this.keyCbs.add(cb);
    return () => this.keyCbs.delete(cb);
  }

  dispose(): void {
    this.canvas.removeEventListener('pointerdown', this.down);
    this.canvas.removeEventListener('pointermove', this.move);
    this.canvas.removeEventListener('pointerup', this.up);
    this.canvas.removeEventListener('wheel', this.wheel);
    this.canvas.removeEventListener('pointerleave', this.leave);
    this.canvas.removeEventListener('mousedown', this.blockFocusSteal);
    this.keyTarget?.removeEventListener('keydown', this.keydown as EventListener);
    this.keyTarget?.removeEventListener('keyup', this.keyup as EventListener);
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

  private blockFocusSteal = (ev: MouseEvent) => ev.preventDefault();

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

  private emitKey(type: KeyInputType, ev: KeyboardEvent): void {
    const input: KeyboardInput = {
      type,
      key: ev.key,
      code: ev.code,
      shift: ev.shiftKey,
      ctrl: ev.ctrlKey,
      alt: ev.altKey,
      meta: ev.metaKey,
      preventDefault: () => ev.preventDefault(),
    };
    for (const cb of this.keyCbs) cb(input);
  }

  private keydown = (ev: KeyboardEvent) => this.emitKey('keydown', ev);
  private keyup = (ev: KeyboardEvent) => this.emitKey('keyup', ev);
}
