import { test, expect } from 'vitest';
import { jsx, jsxs, Fragment } from '../src/jsx-runtime';

test('jsx calls the component with its props', () => {
  const Comp = (props: { a: number }) => ({ tag: 'x', a: props.a });
  expect(jsx(Comp, { a: 5 })).toEqual({ tag: 'x', a: 5 });
});

test('jsxs is jsx (multiple children path)', () => {
  expect(jsxs).toBe(jsx);
});

test('Fragment returns its children', () => {
  const kids = [1, 2, 3];
  expect(Fragment({ children: kids })).toBe(kids);
});
