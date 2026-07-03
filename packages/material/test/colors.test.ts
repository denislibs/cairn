import { describe, it, expect } from 'vitest';
import { lighten, darken, alpha, contrastText } from '../src/colors';

describe('colors', () => {
  it('lighten moves toward white', () => { expect(lighten('#000000', 0.5).toLowerCase()).toBe('#808080'); });
  it('darken moves toward black', () => { expect(darken('#ffffff', 0.5).toLowerCase()).toBe('#808080'); });
  it('alpha yields rgba', () => { expect(alpha('#000000', 0.5)).toBe('rgba(0, 0, 0, 0.5)'); });
  it('contrastText: white on dark, dark on light', () => {
    expect(contrastText('#1976d2')).toBe('#fff');
    expect(contrastText('#ffffff').startsWith('rgba(0, 0, 0')).toBe(true);
  });
});
