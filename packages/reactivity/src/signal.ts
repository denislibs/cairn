import {
  type SignalState,
  type EqualsFn,
  readSource,
  writeSignal,
  defaultEquals,
} from './core';

export type Accessor<T> = () => T;
export type Setter<T> = (value: T | ((prev: T) => T)) => T;

export interface SignalOptions<T> {
  equals?: EqualsFn<T> | false;
}

export function createSignal<T>(
  value: T,
  options?: SignalOptions<T>,
): [Accessor<T>, Setter<T>] {
  const node: SignalState<T> = {
    value,
    observers: null,
    equals: options?.equals ?? defaultEquals,
  };
  const read: Accessor<T> = () => readSource(node);
  const write: Setter<T> = (next) =>
    writeSignal(
      node,
      typeof next === 'function' ? (next as (prev: T) => T)(node.value) : next,
    );
  return [read, write];
}
