import { describe, it, expect } from 'vitest';
import { createRoot } from '@cairn/reactivity';
import { Switch } from '../src/switch';

// Regression: the thumb must actually reposition between off/on. The thumb is the
// Stack's direct child (Switch = track Box > Stack > thumb Box); its `left` is
// driven reactively via style, so toggling updates the thumb's layout.left.
describe('Switch thumb position', () => {
  it('thumb left reflects off/on and updates on toggle', () => {
    createRoot(() => {
      const inst = Switch({ defaultValue: false });
      const stack = inst.children[0];
      const thumb = stack.children[0];
      expect((thumb.layout as any).left).toBe(2);
      inst.handlers!.onClick!({} as any);
      expect((thumb.layout as any).left).toBe(22);
    });
  });
});
