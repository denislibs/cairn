import { describe, it, expect } from 'vitest';
import { parseSvgPath } from '../src/svg-path';

describe('parseSvgPath', () => {
  it('parses absolute M L Z', () => {
    const p = parseSvgPath('M0 0 L10 0 L10 10 Z');
    expect(p.commands).toEqual([
      { type: 'moveTo', x: 0, y: 0 },
      { type: 'lineTo', x: 10, y: 0 },
      { type: 'lineTo', x: 10, y: 10 },
      { type: 'close' },
    ]);
  });
  it('handles relative m/l', () => {
    const p = parseSvgPath('m5 5 l5 0');
    expect(p.commands).toEqual([
      { type: 'moveTo', x: 5, y: 5 },
      { type: 'lineTo', x: 10, y: 5 },
    ]);
  });
  it('parses cubic C', () => {
    const p = parseSvgPath('M0 0 C1 2 3 4 5 6');
    expect(p.commands[1]).toEqual({ type: 'cubicTo', c1x: 1, c1y: 2, c2x: 3, c2y: 4, x: 5, y: 6 });
  });
  it('parses H and V', () => {
    const p = parseSvgPath('M0 0 H10 V10');
    expect(p.commands).toEqual([
      { type: 'moveTo', x: 0, y: 0 },
      { type: 'lineTo', x: 10, y: 0 },
      { type: 'lineTo', x: 10, y: 10 },
    ]);
  });
});
