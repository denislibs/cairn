import { createEffect } from '@cairn/reactivity';
import { scheduleFrame } from './scheduler';

export type MaybeReactive<T> = T | (() => T);

// Apply a value to a sink. If the value is a function it is treated as reactive:
// it re-applies on dependency change and schedules a frame.
//
// Convention/caveats:
// - Any function-shaped value is treated as a reactive accessor. A *static* function
//   value (e.g. an event handler) must be wrapped: `bind(() => handler, apply)`.
// - Reactive binds create an effect; call `bind` only from within an owned reactive
//   scope (a `createRoot`/component under `mount`) so the effect is disposed with it.
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
