import { describe, it, expect } from 'vitest';
import { parseTracks, parsePlacement } from '../src/grid-parse';

describe('parseTracks', () => {
  it('passes an array through', () => {
    const arr = [{ kind: 'px', value: 10 } as const];
    expect(parseTracks(arr)).toEqual(arr);
  });
  it('parses px / fr / auto', () => {
    expect(parseTracks('100px 1fr auto 2fr')).toEqual([
      { kind: 'px', value: 100 }, { kind: 'fr', value: 1 }, { kind: 'auto' }, { kind: 'fr', value: 2 },
    ]);
  });
  it('expands repeat()', () => {
    expect(parseTracks('repeat(3, 1fr)')).toEqual([
      { kind: 'fr', value: 1 }, { kind: 'fr', value: 1 }, { kind: 'fr', value: 1 },
    ]);
    expect(parseTracks('repeat(2, 100px) 1fr')).toEqual([
      { kind: 'px', value: 100 }, { kind: 'px', value: 100 }, { kind: 'fr', value: 1 },
    ]);
  });
});

describe('parsePlacement', () => {
  it('number → start + span 1', () => {
    expect(parsePlacement(2)).toEqual({ start: 2, span: 1 });
  });
  it('"1 / 3" → start/end', () => {
    expect(parsePlacement('1 / 3')).toEqual({ start: 1, end: 3 });
  });
  it('"2 / span 2" → start + span', () => {
    expect(parsePlacement('2 / span 2')).toEqual({ start: 2, span: 2 });
  });
  it('"span 3" → span only', () => {
    expect(parsePlacement('span 3')).toEqual({ span: 3 });
  });
  it('"2" → start + span 1', () => {
    expect(parsePlacement('2')).toEqual({ start: 2, span: 1 });
  });
});
