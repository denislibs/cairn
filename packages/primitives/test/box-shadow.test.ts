import { describe, it, expect } from 'vitest';
import { createRoot } from '@cairn/reactivity';
import { Box } from '../src/box';
import { recordingRenderer } from './recording-renderer';

function paintBox(style: any) {
  return createRoot(() => {
    const inst = Box({ style });
    inst.layout.size = { w: 100, h: 40 };
    const { r, calls } = recordingRenderer();
    inst.paintSelf(r);
    return calls;
  });
}

describe('Box shadows', () => {
  it('array of shadows → one shadowed fill per shadow (drop) before the real fill', () => {
    const calls = paintBox({ backgroundColor: '#fff', boxShadow: [
      { color: '#0008', blur: 4, offsetX: 0, offsetY: 2 },
      { color: '#0004', blur: 12, offsetX: 0, offsetY: 8 },
    ]});
    const setShadows = calls.filter((c) => c.name === 'setShadow' && c.args[0]);
    expect(setShadows.length).toBe(2); // two drop shadows
    const fills = calls.filter((c) => c.name === 'fillRoundRect');
    expect(fills.length).toBeGreaterThanOrEqual(3); // 2 shadow fills + 1 real fill
  });

  it('elevation produces a shadow', () => {
    const calls = paintBox({ backgroundColor: '#fff', elevation: 8 });
    expect(calls.some((c) => c.name === 'setShadow' && c.args[0])).toBe(true);
  });

  it('spread inflates the shadowed rect (wider than the box)', () => {
    const calls = paintBox({ backgroundColor: '#fff', boxShadow: { color:'#0008', blur:4, offsetX:0, offsetY:0, spread: 6 } });
    // find a fillRoundRect whose width > 100 (inflated by 2*spread)
    expect(calls.some((c) => c.name === 'fillRoundRect' && c.args[0].width > 100)).toBe(true);
  });

  it('no shadow → single fill, no setShadow(non-null)', () => {
    const calls = paintBox({ backgroundColor: '#fff' });
    expect(calls.filter((c)=>c.name==='fillRoundRect').length).toBe(1);
    expect(calls.some((c)=>c.name==='setShadow' && c.args[0])).toBe(false);
  });
});
