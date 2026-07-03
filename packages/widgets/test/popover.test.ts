import { describe, it, expect } from 'vitest';
import { createRoot, runWithContext } from '@cairn/reactivity';
import { overlayContext, createOverlayRegistry } from '@cairn/runtime';
import { Popover } from '../src/popover';
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

describe('Popover', () => {
  it('toggles on click; catcher click closes', () => {
    withReg((reg) => {
      const trigger = Box({ style: { width: 40, height: 20 } });
      const pop = Popover({ content: Box({ style: { width: 120, height: 80 } }), children: trigger });
      reg.setAppRoot(pop);
      const t = findTrigger(pop);
      t.handlers.onClick?.({} as any);
      expect(reg.list().length).toBe(1);
      // the overlay is the catcher Stack; find the catcher Box inside it
      const overlay = reg.list()[0];
      // overlay is a Stack wrapping [catcherBox, contentBox]; catcher has onClick
      const catcher = overlay.handlers?.onClick ? overlay : overlay.children?.[0];
      catcher.handlers?.onClick?.({ stopPropagation() {} } as any);
      expect(reg.list().length).toBe(0);
    });
  });

  it('starts closed', () => {
    withReg((reg) => {
      const trigger = Box({ style: { width: 40, height: 20 } });
      Popover({ content: Box({ style: { width: 120, height: 80 } }), children: trigger });
      expect(reg.list().length).toBe(0);
    });
  });

  it('second click closes', () => {
    withReg((reg) => {
      const trigger = Box({ style: { width: 40, height: 20 } });
      const pop = Popover({ content: Box({ style: { width: 120, height: 80 } }), children: trigger });
      reg.setAppRoot(pop);
      const t = findTrigger(pop);
      t.handlers.onClick?.({} as any);
      expect(reg.list().length).toBe(1);
      t.handlers.onClick?.({} as any);
      expect(reg.list().length).toBe(0);
    });
  });

  it('Escape key on catcher closes popover', () => {
    withReg((reg) => {
      const trigger = Box({ style: { width: 40, height: 20 } });
      const pop = Popover({ content: Box({ style: { width: 120, height: 80 } }), children: trigger });
      reg.setAppRoot(pop);
      const t = findTrigger(pop);
      t.handlers.onClick?.({} as any);
      expect(reg.list().length).toBe(1);
      const overlay = reg.list()[0];
      const catcher = overlay.handlers?.onKeyDown ? overlay : overlay.children?.[0];
      catcher.handlers?.onKeyDown?.({ key: 'Escape' } as any);
      expect(reg.list().length).toBe(0);
    });
  });
});
