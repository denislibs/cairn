import { describe, it, expect } from 'vitest';
import { applyTextTransform } from '../src';
describe('applyTextTransform', () => {
  it('none/undefined returns input', () => {
    expect(applyTextTransform('Hello World', undefined)).toBe('Hello World');
    expect(applyTextTransform('Hello World', 'none')).toBe('Hello World');
  });
  it('uppercase / lowercase', () => {
    expect(applyTextTransform('Hi', 'uppercase')).toBe('HI');
    expect(applyTextTransform('Hi', 'lowercase')).toBe('hi');
  });
  it('capitalize each word', () => {
    expect(applyTextTransform('hello world', 'capitalize')).toBe('Hello World');
  });
});
