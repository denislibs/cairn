import { describe, it, expect } from 'vitest';
import { createRoot } from '@cairn/reactivity';
import { Divider } from '../src/divider';
import { recordingRenderer } from './recording-renderer';

it('horizontal divider is a thin box with the given color', () => {
  createRoot(() => {
    const inst = Divider({ orientation: 'horizontal', thickness: 2, color: '#ccc' });
    const n = inst.layout as any;
    expect(n.height).toBe(2);
    inst.layout.size = { w: 100, h: 2 };
    const { r, calls } = recordingRenderer();
    inst.paintSelf(r);
    expect(calls.some((c) => c.name === 'fillRoundRect' && c.args[2].color === '#ccc')).toBe(true);
  });
});
