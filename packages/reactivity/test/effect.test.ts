import { test, expect, vi } from 'vitest';
import { createSignal, createEffect, createRoot, onCleanup } from '../src/index';

test('effect runs once immediately', () => {
  const spy = vi.fn();
  createRoot(() => {
    createEffect(spy);
  });
  expect(spy).toHaveBeenCalledTimes(1);
});

test('effect re-runs when a tracked signal changes', () => {
  const [count, setCount] = createSignal(0);
  const seen: number[] = [];
  createRoot(() => {
    createEffect(() => {
      seen.push(count());
    });
  });
  setCount(1);
  setCount(2);
  expect(seen).toEqual([0, 1, 2]);
});

test('effect does not re-run for untracked signals', () => {
  const [a, setA] = createSignal(0);
  const [b, setB] = createSignal(0);
  const spy = vi.fn(() => a());
  createRoot(() => createEffect(spy));
  setB(1);
  expect(spy).toHaveBeenCalledTimes(1);
});

test('dependencies are re-collected each run (dynamic deps)', () => {
  const [toggle, setToggle] = createSignal(true);
  const [a, setA] = createSignal('a');
  const [b, setB] = createSignal('b');
  const seen: string[] = [];
  createRoot(() => {
    createEffect(() => {
      seen.push(toggle() ? a() : b());
    });
  });
  // currently tracking `a`; changing `b` must not re-run
  setB('b2');
  expect(seen).toEqual(['a']);
  // switch to tracking `b`
  setToggle(false);
  expect(seen).toEqual(['a', 'b2']);
  // now changing `a` must not re-run; changing `b` must
  setA('a2');
  expect(seen).toEqual(['a', 'b2']);
  setB('b3');
  expect(seen).toEqual(['a', 'b2', 'b3']);
});

test('onCleanup runs before each re-run and on dispose', () => {
  const [count, setCount] = createSignal(0);
  const cleanup = vi.fn();
  let dispose!: () => void;
  createRoot((d) => {
    dispose = d;
    createEffect(() => {
      count();
      onCleanup(cleanup);
    });
  });
  expect(cleanup).toHaveBeenCalledTimes(0);
  setCount(1); // cleanup for the first run fires before the second run
  expect(cleanup).toHaveBeenCalledTimes(1);
  dispose(); // cleanup for the second run fires on dispose
  expect(cleanup).toHaveBeenCalledTimes(2);
});
