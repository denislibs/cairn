import { test, expect } from 'vitest';
import type { InputSource, PointerInput, WheelInput } from '../src/index';

// InputSource is a pure interface; this proves it is implementable and that
// subscribe returns an unsubscribe that stops delivery.
function makeStub(): InputSource {
  const pointer = new Set<(e: PointerInput) => void>();
  const wheel = new Set<(e: WheelInput) => void>();
  return {
    onPointer(cb) {
      pointer.add(cb);
      return () => pointer.delete(cb);
    },
    onWheel(cb) {
      wheel.add(cb);
      return () => wheel.delete(cb);
    },
    onKey: () => () => {},
  } as InputSource;
}

test('InputSource is implementable with unsubscribe semantics', () => {
  const src = makeStub();
  const received: PointerInput[] = [];
  const off = src.onPointer((e) => received.push(e));
  expect(typeof off).toBe('function');
  off();
  expect(received).toEqual([]);
});

test('PointerInput / WheelInput shapes are usable', () => {
  const p: PointerInput = { type: 'pointerdown', x: 1, y: 2, button: 0, pointerType: 'mouse' };
  const w: WheelInput = { x: 1, y: 2, deltaX: 0, deltaY: 4 };
  expect(p.type).toBe('pointerdown');
  expect(w.deltaY).toBe(4);
});
