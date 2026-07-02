import { test, expect } from 'vitest';
import { toEdgeInsets } from '../src/index';

test('number expands to all four sides', () => {
  expect(toEdgeInsets(4)).toEqual({ top: 4, right: 4, bottom: 4, left: 4 });
});

test('partial fills missing sides with 0', () => {
  expect(toEdgeInsets({ left: 8 })).toEqual({ top: 0, right: 0, bottom: 0, left: 8 });
});

test('undefined yields all zeros', () => {
  expect(toEdgeInsets(undefined)).toEqual({ top: 0, right: 0, bottom: 0, left: 0 });
});
