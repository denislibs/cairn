import { runWithContext, type Context } from '@cairn/reactivity';
import type { Instance } from './instance';

export interface ProviderProps<T> {
  context: Context<T>;
  value: T;
  // A thunk, evaluated inside the context scope so useContext sees `value`.
  children: () => Instance;
}

// Provide a context value to a subtree. Because our JSX evaluates children eagerly,
// `children` is a thunk that Provider invokes inside the context scope.
export function Provider<T>(props: ProviderProps<T>): Instance {
  return runWithContext(props.context, props.value, () => props.children());
}
