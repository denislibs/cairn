import { createComputation, runUpdates, scheduleEffect, defaultEquals } from './core';

export function createEffect<T>(fn: (prev: T | undefined) => T, value?: T): void {
  const node = createComputation<T | undefined>(
    fn,
    value,
    false, // isMemo
    true, // isEffect
    defaultEquals,
  );
  runUpdates(() => scheduleEffect(node));
}
