import { test, expect, vi } from 'vitest';
import { createSignal, createEffect, createRoot, batch } from '../src/index';

test('batch coalesces multiple writes into a single effect run', () => {
  const [a, setA] = createSignal(0);
  const spy = vi.fn(() => a());
  createRoot(() => createEffect(spy));
  expect(spy).toHaveBeenCalledTimes(1);

  batch(() => {
    setA(1);
    setA(2);
    setA(3);
  });
  expect(spy).toHaveBeenCalledTimes(2);
  expect(a()).toBe(3);
});

test('batch coalesces writes across multiple signals', () => {
  const [a, setA] = createSignal(0);
  const [b, setB] = createSignal(0);
  const spy = vi.fn(() => a() + b());
  createRoot(() => createEffect(spy));
  expect(spy).toHaveBeenCalledTimes(1);

  batch(() => {
    setA(1);
    setB(1);
  });
  expect(spy).toHaveBeenCalledTimes(2);
});

test('batch returns the callback result', () => {
  expect(batch(() => 99)).toBe(99);
});

test('reads inside batch see the latest written value', () => {
  const [a, setA] = createSignal(0);
  const observed = batch(() => {
    setA(5);
    return a();
  });
  expect(observed).toBe(5);
});
