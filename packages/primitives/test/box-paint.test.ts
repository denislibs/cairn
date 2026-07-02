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

  it('wraps fill in shadow save/restore for boxShadow', () => {
    const { calls } = paintBox({
      backgroundColor: '#fff',
      boxShadow: { color: '#000', blur: 4, offsetX: 0, offsetY: 2 },
    });
    const shadowOn = calls.findIndex((c) => c.name === 'setShadow' && c.args[0]);
    const fill = calls.findIndex((c) => c.name === 'fillRoundRect');
    const shadowOff = calls.findIndex((c, i) => i > fill && c.name === 'setShadow' && !c.args[0]);
    expect(shadowOn).toBeGreaterThanOrEqual(0);
    expect(shadowOn).toBeLessThan(fill);
    expect(shadowOff).toBeGreaterThan(fill);
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
