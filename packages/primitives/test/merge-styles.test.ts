import { describe, it, expect } from 'vitest';
import { mergeStyles } from '../src/resolve-input';
import type { StyleInput } from '../src/resolve-input';
import type { Style, Theme } from '@cairn/style';

const fakeTheme: Theme = { colors: { primary: '#3b82f6' } };

it('mergeStyles with plain objects returns a fn that flattens them', () => {
  const merged = mergeStyles({ backgroundColor: '#aaa' } as Style, [{ color: '#bbb' }] as Style[]);
  expect(typeof merged).toBe('function');
  const result = (merged as (t: Theme) => Style[])(fakeTheme);
  expect(result).toEqual([{ backgroundColor: '#aaa' }, { color: '#bbb' }]);
});

it('mergeStyles with a function input invokes it with the theme', () => {
  const fn: StyleInput = (t: Theme) => ({ color: (t.colors as any).primary });
  const merged = mergeStyles(fn);
  const result = (merged as (t: Theme) => Style[])(fakeTheme);
  expect(result).toEqual([{ color: '#3b82f6' }]);
});

it('mergeStyles skips undefined inputs', () => {
  const merged = mergeStyles(undefined, { color: '#ccc' } as Style, undefined);
  const result = (merged as (t: Theme) => Style[])(fakeTheme);
  expect(result).toEqual([{ color: '#ccc' }]);
});

it('mergeStyles with no inputs returns an empty array', () => {
  const merged = mergeStyles();
  const result = (merged as (t: Theme) => Style[])(fakeTheme);
  expect(result).toEqual([]);
});

it('mergeStyles preserves order (later wins when used with resolveStyle)', () => {
  const merged = mergeStyles({ color: '#111' } as Style, { color: '#222' } as Style);
  const result = (merged as (t: Theme) => Style[])(fakeTheme);
  expect(result).toEqual([{ color: '#111' }, { color: '#222' }]);
});
