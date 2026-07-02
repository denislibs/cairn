import type { Style } from './style';

export const StyleSheet = {
  // Typed registry. Identity today; a home for future caching/validation.
  create<T extends Record<string, Style>>(styles: T): T {
    return styles;
  },
};
