import { describe, it, expect } from 'vitest';
import { resolveLength } from '../src/length';
const ctx = { basis: 200, viewportW: 1000, viewportH: 800, rootFontSize: 16 };
describe('resolveLength', () => {
  it('number and px', () => {
    expect(resolveLength(50, ctx)).toBe(50);
    expect(resolveLength('50px', ctx)).toBe(50);
  });
  it('percent of basis', () => {
    expect(resolveLength('50%', ctx)).toBe(100);
  });
  it('percent with non-finite basis → auto', () => {
    expect(resolveLength('50%', { ...ctx, basis: Infinity })).toBe('auto');
  });
  it('vw / vh', () => {
    expect(resolveLength('10vw', ctx)).toBe(100);
    expect(resolveLength('10vh', ctx)).toBe(80);
  });
  it('rem', () => {
    expect(resolveLength('1.5rem', ctx)).toBe(24);
  });
  it('auto', () => {
    expect(resolveLength('auto', ctx)).toBe('auto');
  });
  it('calc(100% - 20px)', () => {
    expect(resolveLength('calc(100% - 20px)', ctx)).toBe(180);
  });
  it('calc(50% + 1rem)', () => {
    expect(resolveLength('calc(50% + 1rem)', ctx)).toBe(116);
  });
  it('undefined → undefined', () => {
    expect(resolveLength(undefined, ctx)).toBe(undefined);
  });
});
