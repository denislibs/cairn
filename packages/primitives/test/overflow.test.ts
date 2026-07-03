import { describe, it, expect } from 'vitest';
import { createRoot } from '@cairn/reactivity';
import { Box } from '../src/box';
import { Row } from '../src/flex';

describe('overflow → clipChildren', () => {
  it('Box overflow hidden clips to borderRadius; clip clips; visible does not', () => {
    createRoot(() => {
      expect(Box({ style: { overflow: 'hidden', borderRadius: 12 } }).clipChildren).toBe(12);
      expect(Box({ style: { overflow: 'clip' } }).clipChildren).toBe(0);
      expect(Box({ style: { borderRadius: 12 } }).clipChildren == null).toBe(true);
    });
  });
  it('Row overflow hidden clips', () => {
    createRoot(() => {
      expect(Row({ style: { overflow: 'hidden' } }).clipChildren).toBe(0);
    });
  });
});
