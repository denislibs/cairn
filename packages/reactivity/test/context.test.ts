import { test, expect } from 'vitest';
import { createContext, useContext } from '../src/index';

test('createContext returns a context with a unique id and default', () => {
  const a = createContext('x');
  const b = createContext('y');
  expect(a.defaultValue).toBe('x');
  expect(typeof a.id).toBe('symbol');
  expect(a.id).not.toBe(b.id);
});

test('useContext returns the default when nothing is provided', () => {
  const ctx = createContext(42);
  expect(useContext(ctx)).toBe(42);
});

test('two distinct contexts do not interfere at their defaults', () => {
  const theme = createContext('light');
  const lang = createContext('en');
  expect(useContext(theme)).toBe('light');
  expect(useContext(lang)).toBe('en');
});
