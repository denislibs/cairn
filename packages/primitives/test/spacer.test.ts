import { describe, it, expect } from 'vitest';
import { createRoot } from '@cairn/reactivity';
import { Spacer } from '../src/spacer';
import { Input, TextInput } from '../src';

describe('Spacer', () => {
  it('flex spacer grows (flex 1 by default)', () => {
    createRoot(() => { expect((Spacer().layout as any).flex).toBe(1); });
  });
  it('custom flex', () => {
    createRoot(() => { expect((Spacer({ flex: 2 }).layout as any).flex).toBe(2); });
  });
  it('fixed size sets width/height and no grow', () => {
    createRoot(() => {
      const n = Spacer({ size: 24 }).layout as any;
      expect(n.width).toBe(24); expect(n.height).toBe(24); expect(n.flex).toBe(0);
    });
  });
});
it('TextInput aliases Input', () => { expect(TextInput).toBe(Input); });
