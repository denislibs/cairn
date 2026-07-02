import { test, expect } from 'vitest';
import { Box, Text, Row } from '../src/index';

test('Box onClick populates instance.handlers', () => {
  const fn = () => {};
  const box = Box({ onClick: fn });
  expect(box.handlers?.onClick).toBe(fn);
});

test('Box is always interactive: hover/pressed handlers present even without event props', () => {
  const box = Box({ style: { width: 10 } });
  // createInteractive always installs pointer handlers to track hover/pressed state.
  expect(box.handlers?.onPointerEnter).toBeTypeOf('function');
  expect(box.handlers?.onPointerLeave).toBeTypeOf('function');
  expect(box.handlers?.onClick).toBeUndefined();
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
