import { describe, it, expect } from 'vitest';
import { createRoot } from '@cairn/reactivity';
import { Icon } from '../src/icon';
import { recordingRenderer } from './recording-renderer';

it('renders a 24-viewbox icon scaled to size', () => {
  createRoot(() => {
    const inst = Icon({ path: 'M2 2 L22 2 L22 22 Z', size: 12, color: '#333' });
    inst.layout.size = { w: 12, h: 12 };
    const { r, calls } = recordingRenderer();
    inst.paintSelf(r);
    expect(calls.some((c) => c.name === 'scale' && c.args[0] === 0.5)).toBe(true);
    expect(calls.some((c) => c.name === 'fillPath')).toBe(true);
  });
});
