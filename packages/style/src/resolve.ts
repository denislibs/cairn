import { type Style, type BaseStyle, type StateName, STATE_ORDER } from './style';

const STATE_KEYS: ReadonlySet<string> = new Set<string>(STATE_ORDER);

// Merge non-state props from `source` into `target` (later wins; undefined skipped).
function mergeBase(target: Record<string, unknown>, source: Record<string, unknown>): void {
  for (const key of Object.keys(source)) {
    if (STATE_KEYS.has(key)) continue;
    const value = source[key];
    if (value !== undefined) target[key] = value;
  }
}

export function resolveStyle(input: Style | Style[], activeStates?: Iterable<StateName>): BaseStyle {
  const styles = Array.isArray(input) ? input : [input];
  const result: Record<string, unknown> = {};

  // Base pass: merge every style's base props (array cascade, later wins).
  for (const s of styles) mergeBase(result, s as Record<string, unknown>);

  // State pass: for each state in fixed precedence, if active, merge its variant
  // from every style (array order preserved within a state).
  if (activeStates) {
    const active = new Set(activeStates);
    for (const state of STATE_ORDER) {
      if (!active.has(state)) continue;
      for (const s of styles) {
        const variant = s[state];
        if (variant) mergeBase(result, variant as Record<string, unknown>);
      }
    }
  }

  return result as BaseStyle;
}
