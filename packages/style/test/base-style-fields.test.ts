import { test, expect } from 'vitest';
import { resolveStyle, type Style } from '../src/index';

test('alignX/alignY/border pass through resolveStyle and cascade', () => {
  const base: Style = { alignX: 'center', border: { width: 1, color: '#000' } };
  const override: Style = { alignY: 'end', border: { width: 2, color: '#fff' } };
  const r = resolveStyle([base, override]);
  expect(r.alignX).toBe('center');
  expect(r.alignY).toBe('end');
  expect(r.border).toEqual({ width: 2, color: '#fff' });
});

test('border can be set in a state variant', () => {
  const r = resolveStyle({ border: { width: 1, color: '#000' }, hover: { border: { width: 2, color: '#f00' } } }, ['hover']);
  expect(r.border).toEqual({ width: 2, color: '#f00' });
});
