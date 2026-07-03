import { describe, it, expect } from 'vitest';
import { lerp, lerpColor, interpolateValue } from '../src';
describe('interpolate', () => {
  it('lerp', () => { expect(lerp(0, 10, 0.5)).toBe(5); });
  it('lerpColor midpoint of #000→#fff', () => {
    expect(lerpColor('#000000', '#ffffff', 0.5)).toBe('rgba(128, 128, 128, 1)');
  });
  it('lerpColor short hex', () => {
    expect(lerpColor('#000', '#fff', 0)).toBe('rgba(0, 0, 0, 1)');
  });
  it('interpolateValue: number → lerp, color → lerpColor, other → snap', () => {
    expect(interpolateValue(0, 10, 0.5)).toBe(5);
    expect(interpolateValue('#000', '#fff', 0.5)).toBe('rgba(128, 128, 128, 1)');
    expect(interpolateValue('a', 'b', 0.3)).toBe('a'); // snap before 1
    expect(interpolateValue('a', 'b', 1)).toBe('b');   // snap at 1
  });
});
