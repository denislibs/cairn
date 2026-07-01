import { test, expect } from 'vitest';
import { createSignal } from '../src/index';

test('returns the initial value', () => {
  const [count] = createSignal(5);
  expect(count()).toBe(5);
});

test('setter updates the value', () => {
  const [count, setCount] = createSignal(0);
  setCount(10);
  expect(count()).toBe(10);
});

test('setter accepts an updater function', () => {
  const [count, setCount] = createSignal(1);
  setCount((prev) => prev + 1);
  expect(count()).toBe(2);
});

test('setter returns the new value', () => {
  const [, setCount] = createSignal(0);
  expect(setCount(7)).toBe(7);
});
