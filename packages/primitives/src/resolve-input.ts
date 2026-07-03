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

// Merge multiple StyleInputs into a single function-form StyleInput.
// Each input is resolved (fn inputs invoked with theme, arrays flattened),
// undefined inputs are skipped. Order is preserved — later entries win when
// passed to resolveStyle.
export function mergeStyles(...inputs: (StyleInput | undefined)[]): StyleInput {
  return (theme: Theme): Style[] => {
    const result: Style[] = [];
    for (const input of inputs) {
      if (input === undefined) continue;
      const resolved = typeof input === 'function' ? input(theme) : input;
      if (Array.isArray(resolved)) {
        for (const s of resolved) result.push(s);
      } else {
        result.push(resolved);
      }
    }
    return result;
  };
}
