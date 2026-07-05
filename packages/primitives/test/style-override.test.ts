import { describe, it, expect, beforeEach } from 'vitest';
import { createRoot } from '@cairn/reactivity';
import { activateStyleOverrides, setStyleProp, toggleStyleProp } from '@cairn/runtime';
import { Box } from '../src/box';

describe('primitive style override', () => {
  beforeEach(() => activateStyleOverrides());

  it('override backgroundColor is reflected in the box resolved style', () => {
    createRoot(() => {
      const b = Box({ style: { backgroundColor: '#ffffff' } });
      expect(b.debugStyle?.backgroundColor).toBe('#ffffff');
      setStyleProp(b, 'backgroundColor', '#ff0000');
      expect(b.debugStyle?.backgroundColor).toBe('#ff0000');
    });
  });

  it('override width feeds the layout node', () => {
    createRoot(() => {
      const b = Box({ style: { width: 100 } });
      expect((b.layout as any).width).toBe(100);
      setStyleProp(b, 'width', 250);
      expect((b.layout as any).width).toBe(250);
    });
  });

  it('toggling a prop off removes it from the resolved style', () => {
    createRoot(() => {
      const b = Box({ style: { backgroundColor: '#abcdef' } });
      toggleStyleProp(b, 'backgroundColor', false);
      expect(b.debugStyle?.backgroundColor).toBeUndefined();
    });
  });
});
