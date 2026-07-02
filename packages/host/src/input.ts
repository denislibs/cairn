export type PointerInputType = 'pointerdown' | 'pointermove' | 'pointerup';

export interface PointerInput {
  type: PointerInputType;
  x: number; // logical px, relative to the surface top-left
  y: number;
  button: number; // 0 = primary
  pointerType: 'mouse' | 'touch' | 'pen';
}

export interface WheelInput {
  x: number;
  y: number;
  deltaX: number;
  deltaY: number;
}

export interface InputSource {
  onPointer(cb: (e: PointerInput) => void): () => void; // returns unsubscribe
  onWheel(cb: (e: WheelInput) => void): () => void; // returns unsubscribe
  onKey(cb: (e: KeyboardInput) => void): () => void; // returns unsubscribe
}

export type KeyInputType = 'keydown' | 'keyup';

export interface KeyboardInput {
  type: KeyInputType;
  key: string; // 'Tab', 'Enter', 'a', 'ArrowDown'
  code: string; // physical key, e.g. 'KeyA'
  shift: boolean;
  ctrl: boolean;
  alt: boolean;
  meta: boolean;
  preventDefault(): void; // synchronously calls the DOM event's preventDefault
}
