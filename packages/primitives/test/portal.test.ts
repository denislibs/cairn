import { describe, it, expect } from 'vitest';
import { createRoot, runWithContext } from '@cairn/reactivity';
import { overlayContext, createOverlayRegistry } from '@cairn/runtime';
import { Portal } from '../src/portal';
import { Box } from '../src/box';

describe('Portal', () => {
  it('registers children as an overlay and renders a zero-size placeholder', () => {
    createRoot(() => {
      const reg = createOverlayRegistry();
      runWithContext(overlayContext, reg, () => {
        const content = Box({ style: { width: 100, height: 50 } });
        const ph = Portal({ children: content });
        expect(reg.list()).toContain(content);
        expect(ph.layout.size == null || (ph.layout as any).width === 0).toBeTruthy();
      });
    });
  });
  it('unregisters on dispose', () => {
    const reg = createOverlayRegistry();
    const dispose = createRoot((d) => {
      runWithContext(overlayContext, reg, () => { Portal({ children: Box({}) }); });
      return d;
    });
    expect(reg.list().length).toBe(1);
    dispose();
    expect(reg.list().length).toBe(0);
  });
});
