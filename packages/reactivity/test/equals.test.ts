import { test, expect, vi } from 'vitest';
import { createSignal, createMemo, createEffect, createRoot } from '../src/index';

test('setting a signal to an equal value does not re-run effects', () => {
  const [a, setA] = createSignal(1);
  const spy = vi.fn(() => a());
  createRoot(() => createEffect(spy));
  expect(spy).toHaveBeenCalledTimes(1);
  setA(1); // same value
  expect(spy).toHaveBeenCalledTimes(1);
  setA(2); // changed
  expect(spy).toHaveBeenCalledTimes(2);
});

test('equals: false always notifies', () => {
  const [a, setA] = createSignal(1, { equals: false });
  const spy = vi.fn(() => a());
  createRoot(() => createEffect(spy));
  expect(spy).toHaveBeenCalledTimes(1);
  setA(1); // same value, but equals:false forces notify
  expect(spy).toHaveBeenCalledTimes(2);
});

test('custom equals controls signal notification', () => {
  const [obj, setObj] = createSignal(
    { id: 1, label: 'a' },
    { equals: (p, n) => p.id === n.id },
  );
  const spy = vi.fn(() => obj());
  createRoot(() => createEffect(spy));
  expect(spy).toHaveBeenCalledTimes(1);
  setObj({ id: 1, label: 'b' }); // same id → treated equal → no re-run
  expect(spy).toHaveBeenCalledTimes(1);
  setObj({ id: 2, label: 'b' }); // different id → re-run
  expect(spy).toHaveBeenCalledTimes(2);
});

test('memo whose value is unchanged does not re-run dependents', () => {
  const [n, setN] = createSignal(2);
  const parity = createMemo(() => n() % 2); // 0 for even
  const spy = vi.fn(() => parity());
  createRoot(() => createEffect(spy));
  expect(spy).toHaveBeenCalledTimes(1);
  setN(4); // parity still 0 → dependent effect must not re-run
  expect(spy).toHaveBeenCalledTimes(1);
  setN(3); // parity now 1 → re-run
  expect(spy).toHaveBeenCalledTimes(2);
});
