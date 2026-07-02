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
  let fired = false;
  const fn = () => {
    fired = true;
  };
  const t = Text({ children: 'hi', onPointerDown: fn });
  // createInteractive wraps down/up; calling the wrapper must fire the user fn.
  t.handlers!.onPointerDown!({} as never);
  expect(fired).toBe(true);
});

test('Row collects onWheel and onPointerUp only', () => {
  const wheel = () => {};
  let upFired = false;
  const up = () => {
    upFired = true;
  };
  const row = Row({ onWheel: wheel, onPointerUp: up });
  // onWheel is passed through by reference; onPointerUp is wrapped, so assert it fires.
  expect(row.handlers?.onWheel).toBe(wheel);
  row.handlers!.onPointerUp!({} as never);
  expect(upFired).toBe(true);
  expect(row.handlers?.onClick).toBeUndefined();
});
