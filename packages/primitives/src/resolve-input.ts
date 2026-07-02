import { resolveStyle, type Style, type BaseStyle, type StateName, type Theme } from '@cairn/style';

export type StyleInput = Style | Style[] | ((theme: Theme) => Style | Style[]);

// Resolve a primitive's style prop against the current theme and active states.
export function resolveStyleInput(
  input: StyleInput | undefined,
  theme: Theme,
  activeStates?: Iterable<StateName>,
): BaseStyle {
  if (input === undefined) return {};
  const styles = typeof input === 'function' ? input(theme) : input;
  return resolveStyle(styles, activeStates);
}
