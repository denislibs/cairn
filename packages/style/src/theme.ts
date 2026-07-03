import { createContext, useContext, type Context } from '@cairn/reactivity';

export interface ThemeTokens {
  colors?: Record<string, string>;
  spacing?: Record<string, number>;
  radii?: Record<string, number>;
  fontSizes?: Record<string, number>;
}
export type Theme = ThemeTokens & Record<string, unknown>;

// Typed identity — a home for future theme normalization.
export function createTheme<T extends Theme>(tokens: T): T {
  return tokens;
}

// Context holds a theme ACCESSOR so a signal-backed theme is tracked by readers.
export const themeContext: Context<() => Theme> = createContext<() => Theme>(() => ({}));

export function useTheme<T extends Theme = Theme>(): T {
  return useContext(themeContext)() as T;
}
