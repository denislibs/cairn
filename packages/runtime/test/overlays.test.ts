import { describe, it, expect } from 'vitest';
import { createRoot, runWithContext } from '@cairn/reactivity';
import { createOverlayRegistry, overlayContext, useOverlays } from '../src/overlays';
import { BoxNode } from '@cairn/layout';

function inst(): any {
  return { layout: new BoxNode({}), children: [], paintSelf() {} };
}

describe('OverlayRegistry', () => {
  it('add/list/remove', () => {
    createRoot(() => {
      const reg = createOverlayRegistry();
      const a = inst(), b = inst();
      const idA = reg.add(a);
      reg.add(b);
      expect(reg.list()).toEqual([a, b]);
      reg.remove(idA);
      expect(reg.list()).toEqual([b]);
    });
  });

  it('useOverlays returns the provided registry', () => {
    createRoot(() => {
      const reg = createOverlayRegistry();
      runWithContext(overlayContext, reg, () => {
        expect(useOverlays()).toBe(reg);
      });
    });
  });

  it('appRoot get/set', () => {
    createRoot(() => {
      const reg = createOverlayRegistry();
      const r = inst();
      reg.setAppRoot(r);
      expect(reg.appRoot()).toBe(r);
    });
  });
});
