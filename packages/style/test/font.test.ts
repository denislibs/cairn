import { describe, it, expect } from 'vitest';
import { composeFont } from '../src';

describe('composeFont', () => {
  it('falls back to font shorthand when no longhands', () => {
    expect(composeFont({ font: 'bold 20px Georgia' })).toBe('bold 20px Georgia');
  });
  it('defaults when nothing set', () => {
    expect(composeFont({})).toBe('16px sans-serif');
  });
  it('composes from longhands', () => {
    expect(composeFont({ fontStyle: 'italic', fontWeight: 'bold', fontSize: 18, fontFamily: 'Arial' }))
      .toBe('italic bold 18px Arial');
  });
  it('longhands use defaults for omitted parts', () => {
    expect(composeFont({ fontSize: 24 })).toBe('normal normal 24px sans-serif');
  });
  it('numeric weight', () => {
    expect(composeFont({ fontWeight: 600, fontFamily: 'Inter' })).toBe('normal 600 16px Inter');
  });
});
