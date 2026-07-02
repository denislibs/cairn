import { createContext, useContext, type Context } from '@cairn/reactivity';

export type Theme = Record<string, unknown>;

// Typed identity — a home for future theme normalization.
export function createTheme<T extends Theme>(tokens: T): T {
  return tokens;
}

export const themeContext: Context<Theme> = createContext<Theme>({});

export function useTheme<T extends Theme = Theme>(): T {
  return useContext(themeContext) as T;
}
