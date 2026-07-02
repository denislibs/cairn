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
}
