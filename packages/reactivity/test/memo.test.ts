import { test, expect, vi } from 'vitest';
import { createSignal, createMemo, createEffect, createRoot } from '../src/index';

test('memo computes a derived value', () => {
  const [a] = createSignal(2);
  createRoot(() => {
    const double = createMemo(() => a() * 2);
    expect(double()).toBe(4);
  });
});

test('memo recomputes when a dependency changes', () => {
  const [a, setA] = createSignal(2);
  createRoot(() => {
    const double = createMemo(() => a() * 2);
    expect(double()).toBe(4);
    setA(5);
    expect(double()).toBe(10);
  });
});

test('memo is cached — does not recompute when read repeatedly', () => {
  const [a, setA] = createSignal(1);
  const compute = vi.fn(() => a() * 2);
  createRoot(() => {
    const double = createMemo(compute);
    double();
    double();
    double();
    expect(compute).toHaveBeenCalledTimes(1);
    setA(2);
    double();
    double();
    expect(compute).toHaveBeenCalledTimes(2);
  });
});

test('memo is lazy — not computed until first read', () => {
  const compute = vi.fn(() => 1);
  createRoot(() => {
    createMemo(compute);
    expect(compute).not.toHaveBeenCalled();
  });
});

test('effects depending on a memo re-run when the memo changes', () => {
  const [a, setA] = createSignal(1);
  const seen: number[] = [];
  createRoot(() => {
    const double = createMemo(() => a() * 2);
    createEffect(() => seen.push(double()));
  });
  expect(seen).toEqual([2]);
  setA(3);
  expect(seen).toEqual([2, 6]);
});
