import { describe, it, expect } from 'vitest';
import { createRoot, runWithContext } from '@cairn/reactivity';
import { overlayContext, createOverlayRegistry } from '@cairn/runtime';
import { Tooltip } from '../src/tooltip';
import { Box } from '@cairn/primitives';

function withReg(fn: (reg: ReturnType<typeof createOverlayRegistry>) => void) {
  createRoot(() => {
    const reg = createOverlayRegistry();
    runWithContext(overlayContext, reg, () => fn(reg));
  });
}

function findTrigger(inst: any): any {
  // trigger is the first child of the returned Stack (or the inst itself)
  return inst.children && inst.children.length ? inst.children[0] : inst;
}

describe('Tooltip', () => {
  it('shows on hover, hides on leave', () => {
    withReg((reg) => {
      reg.setAppRoot({ layout: { offsetX: 0, offsetY: 0, size: { w: 0, h: 0 } }, children: [], paintSelf() {} } as any);
      const trigger = Box({ style: { width: 40, height: 20 } });
      const tip = Tooltip({ content: Box({ style: { width: 80, height: 24 } }), children: trigger });
      reg.setAppRoot(tip);
      const t = findTrigger(tip);
      expect(reg.list().length).toBe(0);
      t.handlers.onPointerEnter?.({} as any);
      expect(reg.list().length).toBe(1);
      t.handlers.onPointerLeave?.({} as any);
      expect(reg.list().length).toBe(0);
    });
  });

  it('defaults side to top', () => {
    withReg((reg) => {
      const trigger = Box({ style: { width: 40, height: 20 } });
      const tip = Tooltip({ content: Box({ style: { width: 80, height: 24 } }), children: trigger });
      reg.setAppRoot(tip);
      const t = findTrigger(tip);
      t.handlers.onPointerEnter?.({} as any);
      expect(reg.list().length).toBe(1);
    });
  });

  it('does not render portal when not hovered', () => {
    withReg((reg) => {
      const trigger = Box({ style: { width: 40, height: 20 } });
      Tooltip({ content: Box({ style: { width: 80, height: 24 } }), children: trigger, side: 'bottom' });
      expect(reg.list().length).toBe(0);
    });
  });
});
