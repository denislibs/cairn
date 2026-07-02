export interface HitNode {
  layout: { offsetX: number; offsetY: number; size: { w: number; h: number } };
  children: HitNode[];
  handlers?: EventHandlers;
}

export interface CairnPointerEvent {
  type: 'pointerdown' | 'pointermove' | 'pointerup' | 'click';
  x: number;
  y: number;
  button: number;
  pointerType: 'mouse' | 'touch' | 'pen';
  target: HitNode;
  stopPropagation(): void;
}

export interface CairnWheelEvent {
  x: number;
  y: number;
  deltaX: number;
  deltaY: number;
  target: HitNode;
  stopPropagation(): void;
}

export interface EventHandlers {
  onPointerDown?(e: CairnPointerEvent): void;
  onPointerMove?(e: CairnPointerEvent): void;
  onPointerUp?(e: CairnPointerEvent): void;
  onClick?(e: CairnPointerEvent): void;
  onWheel?(e: CairnWheelEvent): void;
}
