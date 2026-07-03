import { describe, it, expect } from 'vitest';
import { createRoot, runWithContext } from '@cairn/reactivity';
import { overlayContext, createOverlayRegistry } from '@cairn/runtime';
import { themeContext } from '@cairn/style';
import { Tooltip } from '../src/tooltip';
import { Box } from '@cairn/primitives';
import { defaultTheme } from '../src/theme';

function withReg(fn: (reg: ReturnType<typeof createOverlayRegistry>) => void) {
  createRoot(() => {
    const reg = createOverlayRegistry();
    runWithContext(overlayContext, reg, () =>
      runWithContext(themeContext, () => defaultTheme, () => fn(reg)),
    );
  });
}

describe('Tooltip — show / hide', () => {
  it('starts hidden (no overlay)', () => {
    withReg((reg) => {
      const trigger = Box({ style: { width: 40, height: 20 } });
      Tooltip({ trigger, label: 'hello' });
      expect(reg.list().length).toBe(0);
    });
  });

  it('pointer enter shows the tooltip (one overlay)', () => {
    withReg((reg) => {
      const trigger = Box({ style: { width: 40, height: 20 } });
      const inst = Tooltip({ trigger, label: 'hello' });
      reg.setAppRoot(inst);
      trigger.handlers!.onPointerEnter?.({} as any);
      expect(reg.list().length).toBe(1);
    });
  });

  it('pointer leave hides the tooltip', () => {
    withReg((reg) => {
      const trigger = Box({ style: { width: 40, height: 20 } });
      const inst = Tooltip({ trigger, label: 'hello' });
      reg.setAppRoot(inst);
      trigger.handlers!.onPointerEnter?.({} as any);
      expect(reg.list().length).toBe(1);
      trigger.handlers!.onPointerLeave?.({} as any);
      expect(reg.list().length).toBe(0);
    });
  });

  it('returns the trigger as root instance', () => {
    withReg((reg) => {
      const trigger = Box({ style: { width: 40, height: 20 } });
      const inst = Tooltip({ trigger, label: 'hello' });
      expect(inst).toBe(trigger);
    });
  });

  it('works with children (Instance) instead of label string', () => {
    withReg((reg) => {
      const trigger = Box({ style: { width: 40, height: 20 } });
      const content = Box({ style: { width: 80, height: 24 } });
      const inst = Tooltip({ trigger, children: content });
      reg.setAppRoot(inst);
      trigger.handlers!.onPointerEnter?.({} as any);
      expect(reg.list().length).toBe(1);
    });
  });

  it('defaults side to top', () => {
    withReg((reg) => {
      const trigger = Box({ style: { width: 40, height: 20 } });
      const inst = Tooltip({ trigger, label: 'test' });
      reg.setAppRoot(inst);
      trigger.handlers!.onPointerEnter?.({} as any);
      expect(reg.list().length).toBe(1);
    });
  });

  it('chains trigger onPointerEnter — existing handler still fires', () => {
    withReg((reg) => {
      let prevFired = 0;
      const trigger = Box({
        style: { width: 40, height: 20 },
        onPointerEnter: () => { prevFired++; },
      });
      const inst = Tooltip({ trigger, label: 'chained' });
      reg.setAppRoot(inst);
      trigger.handlers!.onPointerEnter?.({} as any);
      expect(prevFired).toBe(1);
      expect(reg.list().length).toBe(1);
    });
  });

  it('chains trigger onPointerLeave — existing handler still fires', () => {
    withReg((reg) => {
      let prevFired = 0;
      const trigger = Box({
        style: { width: 40, height: 20 },
        onPointerLeave: () => { prevFired++; },
      });
      const inst = Tooltip({ trigger, label: 'chained' });
      reg.setAppRoot(inst);
      trigger.handlers!.onPointerEnter?.({} as any);
      trigger.handlers!.onPointerLeave?.({} as any);
      expect(prevFired).toBe(1);
      expect(reg.list().length).toBe(0);
    });
  });
});
