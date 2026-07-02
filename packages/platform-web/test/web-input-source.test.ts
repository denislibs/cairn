import { test, expect } from 'vitest';
import { WebInputSource } from '../src/index';
import type { PointerInput, WheelInput } from '@cairn/host';

// Minimal fake canvas: records listeners and returns a fixed bounding rect so we
// can assert coordinate conversion (client - rect origin).
function fakeCanvas() {
  const listeners: Record<string, (ev: unknown) => void> = {};
  const canvas = {
    addEventListener(type: string, cb: (ev: unknown) => void) {
      listeners[type] = cb;
    },
    removeEventListener(type: string) {
      delete listeners[type];
    },
    getBoundingClientRect() {
      return { left: 100, top: 50 };
    },
  };
  return { canvas: canvas as unknown as HTMLCanvasElement, listeners };
}

test('normalizes a pointerdown into surface-local coordinates', () => {
  const { canvas, listeners } = fakeCanvas();
  const src = new WebInputSource(canvas);
  const seen: PointerInput[] = [];
  src.onPointer((e) => seen.push(e));
  listeners.pointerdown({ clientX: 130, clientY: 70, button: 0, pointerType: 'mouse' });
  expect(seen).toEqual([{ type: 'pointerdown', x: 30, y: 20, button: 0, pointerType: 'mouse' }]);
});

test('maps pointermove and pointerup types', () => {
  const { canvas, listeners } = fakeCanvas();
  const src = new WebInputSource(canvas);
  const seen: string[] = [];
  src.onPointer((e) => seen.push(e.type));
  listeners.pointermove({ clientX: 100, clientY: 50, button: 0, pointerType: 'mouse' });
  listeners.pointerup({ clientX: 100, clientY: 50, button: 0, pointerType: 'mouse' });
  expect(seen).toEqual(['pointermove', 'pointerup']);
});

test('defaults missing pointerType to mouse', () => {
  const { canvas, listeners } = fakeCanvas();
  const src = new WebInputSource(canvas);
  let seen: PointerInput | undefined;
  src.onPointer((e) => (seen = e));
  listeners.pointerdown({ clientX: 100, clientY: 50, button: 0 });
  expect(seen?.pointerType).toBe('mouse');
});

test('normalizes wheel input with deltas', () => {
  const { canvas, listeners } = fakeCanvas();
  const src = new WebInputSource(canvas);
  const seen: WheelInput[] = [];
  src.onWheel((e) => seen.push(e));
  listeners.wheel({ clientX: 110, clientY: 60, deltaX: 1, deltaY: 8 });
  expect(seen).toEqual([{ x: 10, y: 10, deltaX: 1, deltaY: 8 }]);
});

test('unsubscribe stops delivery', () => {
  const { canvas, listeners } = fakeCanvas();
  const src = new WebInputSource(canvas);
  const seen: PointerInput[] = [];
  const off = src.onPointer((e) => seen.push(e));
  off();
  listeners.pointerdown({ clientX: 130, clientY: 70, button: 0, pointerType: 'mouse' });
  expect(seen).toEqual([]);
});

test('canvas pointerleave emits an out-of-bounds pointermove to clear hover', () => {
  const { canvas, listeners } = fakeCanvas();
  const src = new WebInputSource(canvas);
  const seen: PointerInput[] = [];
  src.onPointer((e) => seen.push(e));
  listeners.pointerleave({ clientX: 100, clientY: 50, button: 0, pointerType: 'mouse' });
  expect(seen).toEqual([{ type: 'pointermove', x: -1, y: -1, button: 0, pointerType: 'mouse' }]);
});
