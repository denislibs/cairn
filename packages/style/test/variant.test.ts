import { describe, it, expect } from 'vitest';
import { resolveVariant } from '../src';
describe('resolveVariant', () => {
  const map = { primary: 1, secondary: 2 };
  it('returns the selected variant', () => {
    expect(resolveVariant(map, 'secondary')).toBe(2);
  });
  it('falls back when selected missing', () => {
    expect(resolveVariant(map, 'ghost', 'primary')).toBe(1);
  });
  it('undefined when selected + fallback both missing', () => {
    expect(resolveVariant(map, undefined)).toBe(undefined);
    expect(resolveVariant(map, 'x', 'y')).toBe(undefined);
  });
});
