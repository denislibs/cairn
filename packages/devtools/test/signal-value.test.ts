import { describe, it, expect } from 'vitest';
import { serializeSignalValue, coerceSignalValue } from '../src/signal-value';

describe('serializeSignalValue', () => {
  it('tags scalars by type', () => {
    expect(serializeSignalValue(5)).toEqual({ value: '5', type: 'number' });
    expect(serializeSignalValue('hi')).toEqual({ value: 'hi', type: 'string' });
    expect(serializeSignalValue(true)).toEqual({ value: 'true', type: 'boolean' });
  });
  it('serializes objects/functions as other', () => {
    expect(serializeSignalValue({ a: 1 })).toEqual({ value: '{"a":1}', type: 'other' });
    const fn = serializeSignalValue(() => {});
    expect(fn.type).toBe('other');
    expect(typeof fn.value).toBe('string');
  });
});

describe('coerceSignalValue', () => {
  it('coerces by the current value type', () => {
    expect(coerceSignalValue(0, '42')).toEqual({ ok: true, value: 42 });
    expect(coerceSignalValue('x', 'hello')).toEqual({ ok: true, value: 'hello' });
    expect(coerceSignalValue(true, 'false')).toEqual({ ok: true, value: false });
    expect(coerceSignalValue('x', '"quoted"')).toEqual({ ok: true, value: 'quoted' });
  });
  it('rejects bad numbers and non-scalars', () => {
    expect(coerceSignalValue(0, 'abc').ok).toBe(false);
    expect(coerceSignalValue({ a: 1 }, '{}').ok).toBe(false);
    expect(coerceSignalValue(undefined, 'x').ok).toBe(false);
  });
});
