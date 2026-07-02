import { test, expect } from 'vitest';
import { Box, Text, Row } from '../src/index';

test('Box onClick populates instance.handlers', () => {
  const fn = () => {};
  const box = Box({ onClick: fn });
  expect(box.handlers?.onClick).toBe(fn);
});

test('Box with no event props has undefined handlers', () => {
  const box = Box({ style: { width: 10 } });
  expect(box.handlers).toBeUndefined();
});

test('Text collects onPointerDown', () => {
  const fn = () => {};
  const t = Text({ children: 'hi', onPointerDown: fn });
  expect(t.handlers?.onPointerDown).toBe(fn);
});

test('Row collects onWheel and onPointerUp only', () => {
  const wheel = () => {};
  const up = () => {};
  const row = Row({ onWheel: wheel, onPointerUp: up });
  expect(row.handlers?.onWheel).toBe(wheel);
  expect(row.handlers?.onPointerUp).toBe(up);
  expect(row.handlers?.onClick).toBeUndefined();
});
