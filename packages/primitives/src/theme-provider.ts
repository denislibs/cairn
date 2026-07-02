import { themeContext, type Theme } from '@cairn/style';
import { Provider, type Instance } from '@cairn/runtime';

export interface ThemeProviderProps {
  theme: Theme;
  children: () => Instance;
}

// Provide a theme to a subtree. Like Provider, `children` is a thunk (eager JSX children).
export function ThemeProvider(props: ThemeProviderProps): Instance {
  return Provider({ context: themeContext, value: props.theme, children: props.children });
}
