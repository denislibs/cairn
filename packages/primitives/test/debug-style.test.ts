import { describe, it, expect } from 'vitest';
import { createRoot } from '@cairn/reactivity';
import { Box } from '../src/box';
import { Text } from '../src/text';

describe('debugStyle', () => {
  it('Box exposes its resolved style', () => {
    createRoot(() => {
      const b = Box({ style: { backgroundColor: '#ff0000', padding: 8, borderRadius: 4 } });
      expect(b.debugStyle?.backgroundColor).toBe('#ff0000');
      expect(b.debugStyle?.padding).toBe(8);
    });
  });
  it('Text exposes its resolved style', () => {
    createRoot(() => {
      const t = Text({ style: { color: '#123456', font: '16px sans-serif' }, children: 'hi' });
      expect(t.debugStyle?.color).toBe('#123456');
    });
  });
});
