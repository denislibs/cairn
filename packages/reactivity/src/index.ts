export const VERSION = '0.0.0';

export { createSignal } from './signal';
export type { Accessor, Setter, SignalOptions } from './signal';

export { createEffect } from './effect';
export { createMemo } from './memo';
export type { MemoOptions } from './memo';

export { createRoot, onCleanup, batch, untrack, getOwner } from './core';
export type { Owner } from './core';
export { createContext, useContext, runWithContext } from './core';
export type { Context } from './core';
export { setReactiveDevHooks, devWriteSignal } from './core';
export type { ReactiveDevHooks, SignalState } from './core';
