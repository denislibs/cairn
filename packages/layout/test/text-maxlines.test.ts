import { describe, it, expect } from 'vitest';
import { TextNode } from '../src/text';

// each char = 10px wide
const ctx: any = { measureText: (t: string) => ({ width: t.length * 10 }) };

describe('TextNode maxLines + ellipsis truncation', () => {
  it('maxLines truncates the line count', () => {
    const n = new TextNode({ text: 'aa bb cc dd ee', style: { font: '16px sans-serif' }, maxLines: 2 });
    // maxW 20 => each word (2 chars = 20px) fits exactly one per line
    n.layout({ minW: 0, maxW: 20, minH: 0, maxH: 1000 }, ctx);
    expect(n.lines.length).toBe(2);
    expect(n.lines).toEqual(['aa', 'bb']);
  });

  it('ellipsis appends … to the last kept line and fits maxW', () => {
    const n = new TextNode({
      text: 'aaaa bbbb cccc',
      style: { font: '16px sans-serif' },
      maxLines: 1,
      ellipsis: '…',
    });
    // maxW 50 => 5 chars. line 1 raw = 'aaaa' (40px). With ellipsis, 'aaaa…' = 5 chars = 50px <= 50, fits.
    n.layout({ minW: 0, maxW: 50, minH: 0, maxH: 1000 }, ctx);
    expect(n.lines.length).toBe(1);
    expect(n.lines[0].endsWith('…')).toBe(true);
    expect(ctx.measureText(n.lines[0]).width).toBeLessThanOrEqual(50);
  });

  it('no truncation when under maxLines', () => {
    const n = new TextNode({ text: 'aa bb', style: { font: '16px sans-serif' }, maxLines: 5 });
    n.layout({ minW: 0, maxW: 1000, minH: 0, maxH: 1000 }, ctx);
    expect(n.lines).toEqual(['aa bb']);
  });

  it('height reflects truncated line count', () => {
    const n = new TextNode({
      text: 'aa bb cc dd',
      style: { font: '16px sans-serif' },
      maxLines: 2,
      lineHeight: 20,
    });
    n.layout({ minW: 0, maxW: 20, minH: 0, maxH: 1000 }, ctx);
    expect(n.lines.length).toBe(2);
    expect(n.size.h).toBe(40); // 2 lines * 20px lineHeight
  });

  it('ellipsis trims characters when last line + ellipsis exceeds maxW', () => {
    const n = new TextNode({
      text: 'abcde fghij',
      style: { font: '16px sans-serif' },
      maxLines: 1,
      ellipsis: '…',
    });
    // maxW 30 => 3 chars. 'abcde' = 50px > 30, so after wrapping line 1 = 'abcde'.
    // 'abcde…' = 60px > 30; trim to 'ab…' = 30px <= 30.
    n.layout({ minW: 0, maxW: 30, minH: 0, maxH: 1000 }, ctx);
    expect(n.lines.length).toBe(1);
    expect(n.lines[0].endsWith('…')).toBe(true);
    expect(ctx.measureText(n.lines[0]).width).toBeLessThanOrEqual(30);
  });
});
