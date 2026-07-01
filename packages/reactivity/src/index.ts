export const VERSION = '0.0.0';

export { createSignal } from './signal';
export type { Accessor, Setter, SignalOptions } from './signal';

export { createEffect } from './effect';

export { createRoot, onCleanup, batch, untrack, getOwner } from './core';
export type { Owner } from './core';
