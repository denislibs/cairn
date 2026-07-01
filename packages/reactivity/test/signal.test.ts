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

test('custom equals treating values as equal keeps the stored value unchanged', () => {
  const initial = { x: 1 };
  const [get, set] = createSignal(initial, { equals: (a, b) => a.x === b.x });
  set({ x: 1 }); // equal by the custom comparator
  expect(get()).toBe(initial); // identity unchanged — value was not stored
  set({ x: 2 }); // differs → stored
  expect(get()).toEqual({ x: 2 });
});

test('equals: false always stores and returns the written value', () => {
  const [get, set] = createSignal(0, { equals: false });
  expect(set(0)).toBe(0); // same value, but forced through
  expect(get()).toBe(0);
});
