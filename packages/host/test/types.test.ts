import { test, expect } from 'vitest';
import type { Rect, FillStyle, Gradient } from '../src/index';

test('value types are constructable and exported', () => {
  const rect: Rect = { x: 1, y: 2, width: 3, height: 4 };
  const fill: FillStyle = { color: '#f00' };
  const grad: Gradient = {
    kind: 'linear',
    from: { x: 0, y: 0 },
    to: { x: 10, y: 0 },
    stops: [
      { offset: 0, color: '#000' },
      { offset: 1, color: '#fff' },
    ],
  };
  expect(rect.width).toBe(3);
  expect(fill.color).toBe('#f00');
  expect(grad.kind).toBe('linear');
});
