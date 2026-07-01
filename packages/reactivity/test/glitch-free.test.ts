import { test, expect, vi } from 'vitest';
import { createSignal, createMemo, createEffect, createRoot } from '../src/index';

test('diamond: effect runs once per write, not once per path', () => {
  const [n, setN] = createSignal(1);
  const seen: number[] = [];
  const spy = vi.fn();
  createRoot(() => {
    const a = createMemo(() => n() + 1);
    const b = createMemo(() => n() * 10);
    createEffect(() => {
      spy();
      seen.push(a() + b());
    });
  });
  expect(spy).toHaveBeenCalledTimes(1);
  expect(seen).toEqual([12]); // (1+1) + (1*10)

  setN(2);
  expect(spy).toHaveBeenCalledTimes(2); // NOT 3
  expect(seen).toEqual([12, 23]); // (2+1) + (2*10)
});

test('deep chain of memos updates consistently', () => {
  const [n, setN] = createSignal(1);
  const seen: number[] = [];
  createRoot(() => {
    const a = createMemo(() => n() + 1);
    const b = createMemo(() => a() + 1);
    const c = createMemo(() => b() + 1);
    createEffect(() => seen.push(c()));
  });
  expect(seen).toEqual([4]); // 1+1+1+1
  setN(10);
  expect(seen).toEqual([4, 13]); // 10+1+1+1
});

test('memo that reads a memo is not recomputed when result is unaffected', () => {
  const [n, setN] = createSignal(2);
  const isEven = createMemo(() => n() % 2 === 0);
  const label = vi.fn(() => (isEven() ? 'even' : 'odd'));
  createRoot(() => {
    const l = createMemo(label);
    createEffect(() => l());
    expect(label).toHaveBeenCalledTimes(1);
    setN(4); // still even → isEven value unchanged → label memo need not recompute
    expect(label).toHaveBeenCalledTimes(1);
    setN(5); // now odd → recompute
    expect(label).toHaveBeenCalledTimes(2);
  });
});
