import { createEffect } from '@cairn/reactivity';
import { scheduleFrame } from './scheduler';

export type MaybeReactive<T> = T | (() => T);

// Apply a value to a sink. If the value is a function it is treated as reactive:
// it re-applies on dependency change and schedules a frame.
export function bind<T>(value: MaybeReactive<T>, apply: (v: T) => void): void {
  if (typeof value === 'function') {
    createEffect(() => {
      apply((value as () => T)());
      scheduleFrame();
    });
  } else {
    apply(value);
  }
}
