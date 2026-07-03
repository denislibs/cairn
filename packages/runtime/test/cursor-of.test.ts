import { expect, it } from 'vitest';
import { cursorOf } from '../src/mount';

it('cursorOf returns first defined cursor target->root, else default', () => {
  expect(cursorOf([{ cursor: 'pointer' }, {}])).toBe('pointer');
  expect(cursorOf([{}, {}])).toBe('default');
  expect(cursorOf([])).toBe('default');
  expect(cursorOf([{}, { cursor: 'grab' }])).toBe('grab');
});
