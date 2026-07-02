import { describe, it, expect } from 'vitest';
import { BoxNode } from '../src/box';

const ctx: any = { measureText: () => ({ width: 0 }) };

describe('aspectRatio', () => {
  it('derives height from width via aspectRatio', () => {
    const box = new BoxNode({ width: 100 });
    (box as any).aspectRatio = 2; // 2:1
    const s = box.layout({ minW: 0, maxW: 200, minH: 0, maxH: 200 }, ctx);
    expect(s.w).toBe(100);
    expect(s.h).toBe(50);
  });

  it('derives width from height via aspectRatio', () => {
    const box = new BoxNode({ height: 50 });
    (box as any).aspectRatio = 2;
    const s = box.layout({ minW: 0, maxW: 200, minH: 0, maxH: 200 }, ctx);
    expect(s.w).toBe(100);
    expect(s.h).toBe(50);
  });

  it('skips derivation when aspectRatio is not set', () => {
    const box = new BoxNode({ width: 100, height: 80 });
    const s = box.layout({ minW: 0, maxW: 200, minH: 0, maxH: 200 }, ctx);
    expect(s.w).toBe(100);
    expect(s.h).toBe(80);
  });

  it('clamps derived height to maxHeight constraint', () => {
    const box = new BoxNode({ width: 100, maxHeight: 30 });
    (box as any).aspectRatio = 2;
    const s = box.layout({ minW: 0, maxW: 200, minH: 0, maxH: 200 }, ctx);
    expect(s.w).toBe(100);
    expect(s.h).toBe(30);
  });

  it('clamps derived width to maxWidth constraint', () => {
    const box = new BoxNode({ height: 50, maxWidth: 80 });
    (box as any).aspectRatio = 2;
    const s = box.layout({ minW: 0, maxW: 200, minH: 0, maxH: 200 }, ctx);
    expect(s.w).toBe(80);
    expect(s.h).toBe(50);
  });
});
