import { describe, it, expect } from 'vitest';
import { createRoot } from '@cairn/reactivity';
import { Box } from '../src/box';

// Regression: parent-data layout fields set via `style` (not just top-level props)
// must reach the layout node.
describe('layout child-props via style', () => {
  it('Box forwards alignSelf/zIndex/flexBasis/flexShrink from style to the node', () => {
    createRoot(() => {
      const inst = Box({ style: { alignSelf: 'center', zIndex: 5, flexBasis: 100, flexShrink: 1 } });
      const n = inst.layout as any;
      expect(n.alignSelf).toBe('center');
      expect(n.zIndex).toBe(5);
      expect(n.flexBasis).toBe(100);
      expect(n.flexShrink).toBe(1);
    });
  });

  it('Box forwards left/top and inset from style', () => {
    createRoot(() => {
      const a = Box({ style: { left: 12, top: 8 } });
      expect((a.layout as any).left).toBe(12);
      expect((a.layout as any).top).toBe(8);

      const b = Box({ style: { inset: 4 } });
      const n = b.layout as any;
      expect([n.left, n.top, n.right, n.bottom]).toEqual([4, 4, 4, 4]);
    });
  });

  it('a top-level prop is not clobbered by a style that omits the field', () => {
    createRoot(() => {
      const inst = Box({ flex: 2, style: { backgroundColor: '#000' } });
      expect((inst.layout as any).flex).toBe(2);
    });
  });
});
