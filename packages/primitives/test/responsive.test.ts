import { describe, it, expect } from 'vitest';
import { pickBreakpoint, responsive } from '../src/responsive';

describe('pickBreakpoint', () => {
  const bps = { sm: 0, md: 768, lg: 1024 };
  it('picks the largest breakpoint whose min <= width', () => {
    expect(pickBreakpoint(500, bps)).toBe('sm');
    expect(pickBreakpoint(800, bps)).toBe('md');
    expect(pickBreakpoint(1200, bps)).toBe('lg');
  });
  it('clamps below smallest to the smallest key', () => {
    expect(pickBreakpoint(-10, bps)).toBe('sm');
  });
});
describe('responsive', () => {
  const order = ['sm', 'md', 'lg'];
  it('returns the value for the active breakpoint', () => {
    expect(responsive({ sm: 1, md: 2, lg: 3 }, 'md', order)).toBe(2);
  });
  it('falls back down the order when active not present', () => {
    expect(responsive({ sm: 1, lg: 3 }, 'md', order)).toBe(1); // md missing → fall to sm
  });
});
