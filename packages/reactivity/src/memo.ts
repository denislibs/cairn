import {
  createComputation,
  updateIfNecessary,
  readSource,
  defaultEquals,
  type EqualsFn,
} from './core';
import { type Accessor } from './signal';

export interface MemoOptions<T> {
  equals?: EqualsFn<T> | false;
}

export function createMemo<T>(
  fn: (prev: T | undefined) => T,
  value?: T,
  options?: MemoOptions<T>,
): Accessor<T> {
  // Casts bridge the public API to core's stricter type. Publicly `fn` gets
  // `prev: T | undefined` (prev is undefined before the first run) and `value`
  // may be omitted; core types the node as `Computation<T>` with `fn(prev: T)`.
  // Safe because the memo is lazy — `fn` runs (producing a real `T`) before any
  // consumer reads the value, and callers already handle `prev` being undefined.
  const node = createComputation<T>(
    fn as (prev: T) => T,
    value as T,
    true, // isMemo
    false, // isEffect
    options?.equals ?? defaultEquals,
  );
  return () => {
    updateIfNecessary(node);
    return readSource(node);
  };
}
