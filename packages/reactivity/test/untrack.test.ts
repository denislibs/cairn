import { test, expect, vi } from 'vitest';
import { createSignal, createEffect, createRoot, untrack } from '../src/index';

test('untracked reads do not create a dependency', () => {
  const [a, setA] = createSignal(0);
  const spy = vi.fn(() => untrack(() => a()));
  createRoot(() => createEffect(spy));
  expect(spy).toHaveBeenCalledTimes(1);
  setA(1);
  expect(spy).toHaveBeenCalledTimes(1);
});

test('untrack returns the callback result', () => {
  const [a] = createSignal(7);
  createRoot(() => {
    expect(untrack(() => a())).toBe(7);
  });
});

test('tracking resumes after untrack within the same effect', () => {
  const [a, setA] = createSignal(0);
  const [b, setB] = createSignal(0);
  const spy = vi.fn(() => {
    untrack(() => a()); // not tracked
    b(); // tracked
  });
  createRoot(() => createEffect(spy));
  expect(spy).toHaveBeenCalledTimes(1);
  setA(1); // no re-run
  expect(spy).toHaveBeenCalledTimes(1);
  setB(1); // re-run
  expect(spy).toHaveBeenCalledTimes(2);
});
