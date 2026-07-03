import { createContext, useContext, type Context } from '@cairn/reactivity';

export interface CompoundContext<T> {
  context: Context<T | null>;
  use: () => T;
}

export function createCompoundContext<T>(name: string): CompoundContext<T> {
  const context = createContext<T | null>(null);

  function use(): T {
    const value = useContext(context);
    if (value === null) {
      throw new Error(`[cairn] ${name} must be used within its <Root>`);
    }
    return value;
  }

  return { context, use };
}
