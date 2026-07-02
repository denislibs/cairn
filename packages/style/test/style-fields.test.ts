import { describe, it, expect } from 'vitest';
import { resolveStyle, type Style } from '../src';

it('BaseStyle accepts new paint fields', () => {
  const s: Style = {
    minWidth: 10, maxWidth: 100, minHeight: 5, maxHeight: 50,
    borderRadius: { tl: 4, tr: 4, br: 0, bl: 0 },
    border: { width: 1, color: '#000', style: 'dashed' },
    borderTop: { width: 2, color: '#f00' },
    backgroundGradient: { kind: 'linear', from: { x: 0, y: 0 }, to: { x: 1, y: 1 }, stops: [{ offset: 0, color: '#000' }] },
    boxShadow: { color: '#0008', blur: 8, offsetX: 0, offsetY: 2 },
    opacity: 0.5,
    textShadow: { color: '#000', blur: 1, offsetX: 0, offsetY: 1 },
    textAlign: 'center',
    lineHeight: 20,
    hover: { opacity: 1 },
  };
  const r = resolveStyle(s, ['hover']);
  expect(r.opacity).toBe(1);
  expect(r.textAlign).toBe('center');
});
