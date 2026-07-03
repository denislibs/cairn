import { describe, it, expect } from 'vitest';
import { createRoot } from '@cairn/reactivity';
import { Box } from '../src/box';
it('Box forwards transform + transformOrigin from style', () => {
  createRoot(() => {
    const inst = Box({ style: { transform: { rotate: 45 }, transformOrigin: { x: 1, y: 2 } } });
    expect(inst.transform).toEqual({ rotate: 45 });
    expect(inst.transformOrigin).toEqual({ x: 1, y: 2 });
  });
});
