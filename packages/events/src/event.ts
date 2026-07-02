export interface HitNode {
  layout: { offsetX: number; offsetY: number; size: { w: number; h: number } };
  children: HitNode[];
  handlers?: EventHandlers;
  focusable?: boolean;
}

export interface CairnPointerEvent {
  type: 'pointerdown' | 'pointermove' | 'pointerup' | 'click' | 'pointerenter' | 'pointerleave';
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

export interface CairnKeyboardEvent {
  type: 'keydown' | 'keyup';
  key: string;
  code: string;
  shift: boolean;
  ctrl: boolean;
  alt: boolean;
  meta: boolean;
  target: HitNode;
  stopPropagation(): void;
  preventDefault(): void;
}

export interface CairnFocusEvent {
  target: HitNode;
}

export interface EventHandlers {
  onPointerDown?(e: CairnPointerEvent): void;
  onPointerMove?(e: CairnPointerEvent): void;
  onPointerUp?(e: CairnPointerEvent): void;
  onPointerEnter?(e: CairnPointerEvent): void;
  onPointerLeave?(e: CairnPointerEvent): void;
  onKeyDown?(e: CairnKeyboardEvent): void;
  onKeyUp?(e: CairnKeyboardEvent): void;
  onFocus?(e: CairnFocusEvent): void;
  onBlur?(e: CairnFocusEvent): void;
  onClick?(e: CairnPointerEvent): void;
  onWheel?(e: CairnWheelEvent): void;
}
