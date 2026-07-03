import { describe, it, expect } from 'vitest';
import { TextNode } from '../src/text';

// each char = 10px wide (ignores letterSpacing for the fake)
const ctx: any = { measureText: (t: string) => ({ width: t.length * 10 }) };

describe('TextNode word wrapping', () => {
  it('wraps at word boundaries to maxW', () => {
    const n = new TextNode({ text: 'aaa bbb ccc', style: { font: '16px sans-serif' } });
    // "aaa bbb" = 7 chars = 70px; adding " ccc" -> 11 chars = 110 > 80 => wrap
    n.layout({ minW: 0, maxW: 80, minH: 0, maxH: 1000 }, ctx);
    expect(n.lines).toEqual(['aaa bbb', 'ccc']);
  });

  it('honors explicit newlines', () => {
    const n = new TextNode({ text: 'a\nb', style: { font: '16px sans-serif' } });
    n.layout({ minW: 0, maxW: 1000, minH: 0, maxH: 1000 }, ctx);
    expect(n.lines).toEqual(['a', 'b']);
  });

  it('unbounded maxW keeps one line per paragraph', () => {
    const n = new TextNode({ text: 'aaa bbb ccc', style: { font: '16px sans-serif' } });
    n.layout({ minW: 0, maxW: Infinity, minH: 0, maxH: Infinity }, ctx);
    expect(n.lines).toEqual(['aaa bbb ccc']);
  });

  it('size: width=widest line, height=lineCount*lineHeight', () => {
    const n = new TextNode({ text: 'aaa bbb ccc', style: { font: '16px sans-serif' }, lineHeight: 20 });
    const s = n.layout({ minW: 0, maxW: 80, minH: 0, maxH: 1000 }, ctx);
    expect(s.w).toBe(70);   // 'aaa bbb' = 70
    expect(s.h).toBe(40);   // 2 lines * 20
  });
});
