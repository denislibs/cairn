import { test, expect } from 'vitest';
import type { InputSource, KeyboardInput } from '../src/index';

function makeStub(): InputSource {
  const keys = new Set<(e: KeyboardInput) => void>();
  return {
    onPointer: () => () => {},
    onWheel: () => () => {},
    onKey(cb) {
      keys.add(cb);
      return () => keys.delete(cb);
    },
  };
}

test('InputSource.onKey is implementable with unsubscribe', () => {
  const src = makeStub();
  const off = src.onKey(() => {});
  expect(typeof off).toBe('function');
  off();
});

test('KeyboardInput shape is usable', () => {
  let prevented = false;
  const k: KeyboardInput = {
    type: 'keydown',
    key: 'Tab',
    code: 'Tab',
    shift: false,
    ctrl: false,
    alt: false,
    meta: false,
    preventDefault: () => {
      prevented = true;
    },
  };
  k.preventDefault();
  expect(k.type).toBe('keydown');
  expect(prevented).toBe(true);
});
