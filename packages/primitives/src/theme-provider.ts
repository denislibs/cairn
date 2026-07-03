import { themeContext, type Theme } from '@cairn/style';
import { Provider, type Instance } from '@cairn/runtime';

export interface ThemeProviderProps {
  theme: Theme | (() => Theme);
  children: () => Instance;
}

// Provide a theme to a subtree. Like Provider, `children` is a thunk (eager JSX children).
// `theme` can be a static object or a reactive accessor (e.g. a signal) for live restyle.
export function ThemeProvider(props: ThemeProviderProps): Instance {
  const getter = typeof props.theme === 'function' ? (props.theme as () => Theme) : () => props.theme as Theme;
  return Provider({ context: themeContext, value: getter, children: props.children });
}
