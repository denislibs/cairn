import { describe, it, expect } from 'vitest';
import { createRoot } from '@cairn/reactivity';
import { Text } from '../src/text';
import { recordingRenderer } from './recording-renderer';

// Fake ctx: each char = 10px wide
const fakeCtx: any = { measureText: (t: string) => ({ width: t.length * 10 }) };

describe('Text multi-line paint', () => {
  it('paints one drawText per line with ascending y (lineHeight set)', () => {
    createRoot(() => {
      const inst = Text({ style: { lineHeight: 20 }, children: 'aaa bbb ccc' });
      // Force layout with a 80px maxW so 'aaa bbb ccc' wraps to ['aaa bbb', 'ccc']
      inst.layout.layout({ minW: 0, maxW: 80, minH: 0, maxH: 1000 }, fakeCtx);
      inst.layout.size = inst.layout.size; // already set by layout()

      const { r, calls } = recordingRenderer();
      inst.paintSelf(r);

      const drawCalls = calls.filter((c) => c.name === 'drawText');
      expect(drawCalls.length).toBe(2);

      // First line: y = 0 * 20 + 20/2 = 10 (middle baseline)
      expect(drawCalls[0].args[0]).toBe('aaa bbb');
      expect(drawCalls[0].args[1].y).toBe(10);
      expect(drawCalls[0].args[2].baseline).toBe('middle');

      // Second line: y = 1 * 20 + 20/2 = 30
      expect(drawCalls[1].args[0]).toBe('ccc');
      expect(drawCalls[1].args[1].y).toBe(30);
      expect(drawCalls[1].args[2].baseline).toBe('middle');
    });
  });

  it('paints one drawText per line with ascending y (no lineHeight, top baseline)', () => {
    createRoot(() => {
      const inst = Text({ style: { font: '16px sans-serif' }, children: 'a\nb' });
      // '\n' forces two lines regardless of maxW
      inst.layout.layout({ minW: 0, maxW: 1000, minH: 0, maxH: 1000 }, fakeCtx);

      const { r, calls } = recordingRenderer();
      inst.paintSelf(r);

      const drawCalls = calls.filter((c) => c.name === 'drawText');
      expect(drawCalls.length).toBe(2);

      // No lineHeight: fontSize from font = 16, top baseline
      expect(drawCalls[0].args[0]).toBe('a');
      expect(drawCalls[0].args[1].y).toBe(0);
      expect(drawCalls[0].args[2].baseline).toBe('top');

      expect(drawCalls[1].args[0]).toBe('b');
      expect(drawCalls[1].args[1].y).toBe(16);
      expect(drawCalls[1].args[2].baseline).toBe('top');
    });
  });

  it('single-line text still produces one drawText at y=0', () => {
    createRoot(() => {
      const inst = Text({ style: { font: '16px sans-serif' }, children: 'hello' });
      inst.layout.layout({ minW: 0, maxW: 1000, minH: 0, maxH: 1000 }, fakeCtx);

      const { r, calls } = recordingRenderer();
      inst.paintSelf(r);

      const drawCalls = calls.filter((c) => c.name === 'drawText');
      expect(drawCalls.length).toBe(1);
      expect(drawCalls[0].args[1].y).toBe(0);
    });
  });
});
