import { test, expect } from 'vitest';
import { createPath } from '../src/index';

test('builds a path as an immutable command list', () => {
  const path = createPath()
    .moveTo(0, 0)
    .lineTo(10, 0)
    .lineTo(10, 10)
    .close()
    .build();

  expect(path.commands).toEqual([
    { type: 'moveTo', x: 0, y: 0 },
    { type: 'lineTo', x: 10, y: 0 },
    { type: 'lineTo', x: 10, y: 10 },
    { type: 'close' },
  ]);
});

test('supports arc and quadTo', () => {
  const path = createPath().arc(5, 5, 5, 0, Math.PI).quadTo(1, 2, 3, 4).build();
  expect(path.commands).toEqual([
    { type: 'arc', cx: 5, cy: 5, r: 5, start: 0, end: Math.PI },
    { type: 'quadTo', cx: 1, cy: 2, x: 3, y: 4 },
  ]);
});

test('builder methods are chainable and build returns a snapshot', () => {
  const builder = createPath().moveTo(1, 1);
  const p1 = builder.build();
  builder.lineTo(2, 2);
  const p2 = builder.build();
  // p1 must not be mutated by later builder calls
  expect(p1.commands).toEqual([{ type: 'moveTo', x: 1, y: 1 }]);
  expect(p2.commands).toEqual([
    { type: 'moveTo', x: 1, y: 1 },
    { type: 'lineTo', x: 2, y: 2 },
  ]);
});
