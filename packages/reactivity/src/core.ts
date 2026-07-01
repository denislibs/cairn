// Fine-grained reactive engine. No DOM APIs — platform-agnostic.

export type EqualsFn<T> = (prev: T, next: T) => boolean;
export const defaultEquals = <T>(a: T, b: T): boolean => a === b;

export interface SignalState<T> {
  value: T;
  observers: Computation<any>[] | null;
  equals: EqualsFn<T> | false;
}

// Placeholder — fleshed out in a later task.
export interface Computation<T> {
  value: T;
}

export function readSource<T>(node: SignalState<T>): T {
  return node.value;
}

export function writeSignal<T>(node: SignalState<T>, value: T): T {
  if (node.equals === false || !node.equals(node.value, value)) {
    node.value = value;
  }
  return value;
}
