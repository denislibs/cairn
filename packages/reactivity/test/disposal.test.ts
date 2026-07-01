import { test, expect, vi } from 'vitest';
import { createSignal, createEffect, createRoot } from '../src/index';

test('disposing the root stops its effects', () => {
  const [a, setA] = createSignal(0);
  const spy = vi.fn(() => a());
  let dispose!: () => void;
  createRoot((d) => {
    dispose = d;
    createEffect(spy);
  });
  expect(spy).toHaveBeenCalledTimes(1);
  setA(1);
  expect(spy).toHaveBeenCalledTimes(2);
  dispose();
  setA(2);
  expect(spy).toHaveBeenCalledTimes(2); // no more runs
});

test('nested effect is disposed and recreated across parent re-runs', () => {
  const [outer, setOuter] = createSignal(0);
  const [inner, setInner] = createSignal(0);
  const innerSpy = vi.fn(() => inner());
  createRoot(() => {
    createEffect(() => {
      outer();
      createEffect(innerSpy); // child owned by the outer effect
    });
  });
  // outer ran once → inner created + ran once
  expect(innerSpy).toHaveBeenCalledTimes(1);

  setInner(1); // one live inner effect re-runs
  expect(innerSpy).toHaveBeenCalledTimes(2);

  setOuter(1); // outer re-runs: old inner disposed, a new inner created + runs
  expect(innerSpy).toHaveBeenCalledTimes(3);

  setInner(2); // only the newest inner is alive → exactly one more run
  expect(innerSpy).toHaveBeenCalledTimes(4);
});

test('an infinite update loop throws instead of hanging', () => {
  expect(() => {
    createRoot(() => {
      const [a, setA] = createSignal(0);
      createEffect(() => {
        setA(a() + 1); // writes its own dependency → self-perpetuating
      });
    });
  }).toThrow(/infinite update loop/i);
});
