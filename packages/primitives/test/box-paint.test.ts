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
    return { inst, calls };
  });
}

describe('Box paint', () => {
  it('fills with backgroundGradient (precedence over color)', () => {
    const { calls } = paintBox({
      backgroundColor: '#fff',
      backgroundGradient: {
        kind: 'linear',
        from: { x: 0, y: 0 },
        to: { x: 0, y: 1 },
        stops: [{ offset: 0, color: '#000' }],
      },
    });
    const fill = calls.find((c) => c.name === 'fillRoundRect');
    expect(fill!.args[2].gradient).toBeTruthy();
  });

  it('drop shadow: a shadowed fill precedes the real fill, then shadow is cleared', () => {
    const { calls } = paintBox({
      backgroundColor: '#fff',
      boxShadow: { color: '#000', blur: 4, offsetX: 0, offsetY: 2 },
    });
    // The first setShadow(non-null) should come before the first fillRoundRect (shadow fill)
    const shadowOn = calls.findIndex((c) => c.name === 'setShadow' && c.args[0]);
    const firstFill = calls.findIndex((c) => c.name === 'fillRoundRect');
    // There should be at least 2 fills: the shadow fill and the real fill
    const fills = calls.filter((c) => c.name === 'fillRoundRect');
    const lastFill = calls.map((c, i) => ({ c, i })).filter(({ c }) => c.name === 'fillRoundRect').at(-1)!.i;
    // setShadow(null) occurs between the shadow fill and the real fill
    const shadowOff = calls.findIndex((c, i) => i > firstFill && c.name === 'setShadow' && !c.args[0]);
    expect(shadowOn).toBeGreaterThanOrEqual(0);
    expect(shadowOn).toBeLessThan(firstFill);
    expect(shadowOff).toBeGreaterThan(firstFill);
    expect(shadowOff).toBeLessThan(lastFill);
    expect(fills.length).toBeGreaterThanOrEqual(2);
  });

  it('per-corner borderRadius passed through', () => {
    const { calls } = paintBox({
      backgroundColor: '#fff',
      borderRadius: { tl: 8, tr: 8, br: 0, bl: 0 },
    });
    const fill = calls.find((c) => c.name === 'fillRoundRect');
    expect(fill!.args[1]).toEqual({ tl: 8, tr: 8, br: 0, bl: 0 });
  });

  it('dashed border sets line dash', () => {
    const { calls } = paintBox({ border: { width: 2, color: '#000', style: 'dashed' } });
    expect(calls.some((c) => c.name === 'setLineDash' && c.args[0].length > 0)).toBe(true);
  });

  it('per-side top border draws a stroked line', () => {
    const { calls } = paintBox({ borderTop: { width: 2, color: '#f00' } });
    expect(calls.some((c) => c.name === 'strokePath' || c.name === 'strokeRect')).toBe(true);
  });

  it('sets paintOpacity from style', () => {
    const { inst } = paintBox({ opacity: 0.3 });
    expect(inst.paintOpacity).toBe(0.3);
  });

  it('forwards min/max to the BoxNode', () => {
    createRoot(() => {
      const inst = Box({ style: { minWidth: 10, maxWidth: 90, minHeight: 5, maxHeight: 40 } });
      const n = inst.layout as any;
      expect([n.minWidth, n.maxWidth, n.minHeight, n.maxHeight]).toEqual([10, 90, 5, 40]);
    });
  });
});
