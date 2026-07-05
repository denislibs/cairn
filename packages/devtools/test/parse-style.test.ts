import { describe, it, expect } from 'vitest';
import { parseStyleValue, isEditableProp } from '../src/parse-style';

describe('parseStyleValue', () => {
  it('passes colors and font strings through', () => {
    expect(parseStyleValue('backgroundColor', '#ff0000')).toEqual({ ok: true, value: '#ff0000' });
    expect(parseStyleValue('color', 'rgb(1,2,3)')).toEqual({ ok: true, value: 'rgb(1,2,3)' });
    expect(parseStyleValue('font', '600 14px sans-serif')).toEqual({ ok: true, value: '600 14px sans-serif' });
  });
  it('parses numeric props', () => {
    expect(parseStyleValue('opacity', '0.5')).toEqual({ ok: true, value: 0.5 });
    expect(parseStyleValue('borderRadius', '6')).toEqual({ ok: true, value: 6 });
    expect(parseStyleValue('gap', '8')).toEqual({ ok: true, value: 8 });
    expect(parseStyleValue('width', '250')).toEqual({ ok: true, value: 250 });
  });
  it('parses padding shorthand', () => {
    expect(parseStyleValue('padding', '4')).toEqual({ ok: true, value: 4 });
    expect(parseStyleValue('padding', '2 8')).toEqual({ ok: true, value: { top: 2, right: 8, bottom: 2, left: 8 } });
    expect(parseStyleValue('padding', '1 2 3 4')).toEqual({ ok: true, value: { top: 1, right: 2, bottom: 3, left: 4 } });
  });
  it('rejects non-editable props and garbage numbers', () => {
    expect(parseStyleValue('boxShadow', 'whatever').ok).toBe(false);
    expect(parseStyleValue('transform', 'x').ok).toBe(false);
    expect(parseStyleValue('opacity', 'abc').ok).toBe(false);
  });
  it('anchors numbers and accepts leading-dot decimals', () => {
    expect(parseStyleValue('opacity', '0.5abc').ok).toBe(false);   // trailing garbage rejected
    expect(parseStyleValue('opacity', '.5')).toEqual({ ok: true, value: 0.5 });
    expect(parseStyleValue('width', '250xyz').ok).toBe(false);
    expect(parseStyleValue('gap', '-4')).toEqual({ ok: true, value: -4 });
  });
  it('isEditableProp guards known props', () => {
    expect(isEditableProp('backgroundColor')).toBe(true);
    expect(isEditableProp('boxShadow')).toBe(false);
  });
  it('border is not editable and does not parse', () => {
    expect(isEditableProp('border')).toBe(false);
    expect(parseStyleValue('border', '1px solid #000').ok).toBe(false);
  });
  it('padding 4-token round-trips correctly', () => {
    expect(parseStyleValue('padding', '4 8 4 8')).toEqual({ ok: true, value: { top: 4, right: 8, bottom: 4, left: 8 } });
  });
});
