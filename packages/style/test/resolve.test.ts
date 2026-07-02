import { test, expect } from 'vitest';
import { resolveStyle } from '../src/index';

test('base only: returns the base props', () => {
  expect(resolveStyle({ width: 10, backgroundColor: '#f00' })).toEqual({
    width: 10,
    backgroundColor: '#f00',
  });
});

test('resolved result never contains state keys', () => {
  const out = resolveStyle({ width: 10, hover: { width: 20 } });
  expect(out).toEqual({ width: 10 });
  expect('hover' in out).toBe(false);
});

test('array cascade: later styles win; undefined does not overwrite', () => {
  const out = resolveStyle([
    { width: 10, backgroundColor: '#111' },
    { backgroundColor: '#222', height: 20 },
  ]);
  expect(out).toEqual({ width: 10, backgroundColor: '#222', height: 20 });
});

test('single active state is merged over the base', () => {
  const out = resolveStyle({ backgroundColor: 'blue', hover: { backgroundColor: 'navy' } }, ['hover']);
  expect(out.backgroundColor).toBe('navy');
});

test('inactive states are ignored', () => {
  const out = resolveStyle({ backgroundColor: 'blue', hover: { backgroundColor: 'navy' } }, ['focus']);
  expect(out.backgroundColor).toBe('blue');
});

test('multiple active states apply in fixed precedence (disabled wins)', () => {
  const out = resolveStyle(
    {
      backgroundColor: 'blue',
      hover: { backgroundColor: 'navy' },
      disabled: { backgroundColor: 'gray' },
    },
    ['disabled', 'hover'], // order in the set does not matter
  );
  expect(out.backgroundColor).toBe('gray'); // disabled has highest precedence
});

test('state variants cascade across an array in precedence order', () => {
  const out = resolveStyle(
    [
      { color: 'black', hover: { color: 'blue' } },
      { hover: { color: 'green' } },
    ],
    ['hover'],
  );
  expect(out.color).toBe('green'); // later array entry's hover wins
});

test('explicit undefined in a later style does not overwrite an earlier value', () => {
  const out = resolveStyle([{ width: 10 }, { width: undefined }]);
  expect(out.width).toBe(10);
});

test('activeStates accepts any iterable (e.g. a Set)', () => {
  const out = resolveStyle(
    { backgroundColor: 'blue', hover: { backgroundColor: 'navy' } },
    new Set(['hover'] as const),
  );
  expect(out.backgroundColor).toBe('navy');
});

test('state keys never leak even when the state is active', () => {
  const out = resolveStyle({ width: 1, hover: { width: 2 } }, ['hover']);
  expect('hover' in out).toBe(false);
  expect(out.width).toBe(2);
});
