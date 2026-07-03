// Pick a variant value by key, with an optional fallback key.
export function resolveVariant<T>(
  map: Record<string, T>,
  selected: string | undefined,
  fallback?: string,
): T | undefined {
  if (selected !== undefined && selected in map) return map[selected];
  if (fallback !== undefined && fallback in map) return map[fallback];
  return undefined;
}
