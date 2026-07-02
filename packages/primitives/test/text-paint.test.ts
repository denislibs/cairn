import { describe, it, expect } from 'vitest';
import { createRoot } from '@cairn/reactivity';
import { Text } from '../src/text';
import { recordingRenderer } from './recording-renderer';

function paintText(style: any, content = 'hi') {
  return createRoot(() => {
    const inst = Text({ style, children: content });
    inst.layout.size = { w: 80, h: 20 };
    const { r, calls } = recordingRenderer();
    inst.paintSelf(r);
    return { inst, calls };
  });
}

describe('Text paint', () => {
  it('textAlign=center anchors x at box center and sets align', () => {
    const { calls } = paintText({ textAlign: 'center' });
    const dt = calls.find((c) => c.name === 'drawText')!;
    expect(dt.args[2].align).toBe('center');
    expect(dt.args[1].x).toBe(40);
  });
  it('textAlign=right anchors x at box right', () => {
    const { calls } = paintText({ textAlign: 'right' });
    const dt = calls.find((c) => c.name === 'drawText')!;
    expect(dt.args[1].x).toBe(80);
  });
  it('textShadow wraps drawText in setShadow', () => {
    const { calls } = paintText({ textShadow: { color: '#000', blur: 1, offsetX: 0, offsetY: 1 } });
    const on = calls.findIndex((c) => c.name === 'setShadow' && c.args[0]);
    const dt = calls.findIndex((c) => c.name === 'drawText');
    expect(on).toBeGreaterThanOrEqual(0);
    expect(on).toBeLessThan(dt);
  });
  it('lineHeight centers baseline (middle)', () => {
    const { calls } = paintText({ lineHeight: 20 });
    const dt = calls.find((c) => c.name === 'drawText')!;
    expect(dt.args[2].baseline).toBe('middle');
    expect(dt.args[1].y).toBe(10);
  });
  it('opacity forwarded to paintOpacity', () => {
    const { inst } = paintText({ opacity: 0.4 });
    expect(inst.paintOpacity).toBe(0.4);
  });
});
