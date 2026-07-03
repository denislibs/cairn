import { describe, it, expect } from 'vitest';
import { createRoot, runWithContext, createSignal } from '@cairn/reactivity';
import { overlayContext, createOverlayRegistry } from '@cairn/runtime';
import { themeContext } from '@cairn/style';
import { Popover } from '../src/popover';
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

describe('Popover — uncontrolled', () => {
  it('starts closed (no overlay registered)', () => {
    withReg((reg) => {
      const trigger = Box({ style: { width: 40, height: 20 } });
      const content = Box({ style: { width: 120, height: 80 } });
      Popover({ trigger, children: content });
      expect(reg.list().length).toBe(0);
    });
  });

  it('trigger click opens the popover (one overlay)', () => {
    withReg((reg) => {
      const trigger = Box({ style: { width: 40, height: 20 } });
      const content = Box({ style: { width: 120, height: 80 } });
      const inst = Popover({ trigger, children: content });
      reg.setAppRoot(inst);
      trigger.handlers!.onClick?.({} as any);
      expect(reg.list().length).toBe(1);
    });
  });

  it('second trigger click closes (toggle)', () => {
    withReg((reg) => {
      const trigger = Box({ style: { width: 40, height: 20 } });
      const content = Box({ style: { width: 120, height: 80 } });
      const inst = Popover({ trigger, children: content });
      reg.setAppRoot(inst);
      trigger.handlers!.onClick?.({} as any);
      expect(reg.list().length).toBe(1);
      trigger.handlers!.onClick?.({} as any);
      expect(reg.list().length).toBe(0);
    });
  });

  it('catcher click closes the popover', () => {
    withReg((reg) => {
      const trigger = Box({ style: { width: 40, height: 20 } });
      const content = Box({ style: { width: 120, height: 80 } });
      const inst = Popover({ trigger, children: content });
      reg.setAppRoot(inst);
      trigger.handlers!.onClick?.({} as any);
      expect(reg.list().length).toBe(1);
      // overlay root is the Stack/Box with a catcher as first child
      const overlay = reg.list()[0];
      const catcher = overlay.handlers?.onClick ? overlay : overlay.children?.[0];
      catcher.handlers?.onClick?.({ stopPropagation() {} } as any);
      expect(reg.list().length).toBe(0);
    });
  });

  it('Escape on catcher closes the popover', () => {
    withReg((reg) => {
      const trigger = Box({ style: { width: 40, height: 20 } });
      const content = Box({ style: { width: 120, height: 80 } });
      const inst = Popover({ trigger, children: content });
      reg.setAppRoot(inst);
      trigger.handlers!.onClick?.({} as any);
      const overlay = reg.list()[0];
      const catcher = overlay.handlers?.onKeyDown ? overlay : overlay.children?.[0];
      catcher.handlers?.onKeyDown?.({ key: 'Escape' } as any);
      expect(reg.list().length).toBe(0);
    });
  });

  it('returns the trigger as the root instance', () => {
    withReg((reg) => {
      const trigger = Box({ style: { width: 40, height: 20 } });
      const content = Box({ style: { width: 120, height: 80 } });
      const inst = Popover({ trigger, children: content });
      expect(inst).toBe(trigger);
    });
  });

  it('defaultOpen:true opens immediately', () => {
    withReg((reg) => {
      const trigger = Box({ style: { width: 40, height: 20 } });
      const content = Box({ style: { width: 120, height: 80 } });
      Popover({ trigger, children: content, defaultOpen: true });
      expect(reg.list().length).toBe(1);
    });
  });

  it('chains trigger onClick — existing handler still fires', () => {
    withReg((reg) => {
      let prevFired = 0;
      const trigger = Box({
        style: { width: 40, height: 20 },
        onClick: () => { prevFired++; },
      });
      const content = Box({ style: { width: 120, height: 80 } });
      const inst = Popover({ trigger, children: content });
      reg.setAppRoot(inst);
      trigger.handlers!.onClick?.({} as any);
      expect(prevFired).toBe(1);
      expect(reg.list().length).toBe(1);
    });
  });
});

describe('Popover — controlled', () => {
  it('controlled open:true shows overlay', () => {
    withReg((reg) => {
      const [open] = createSignal(true);
      const trigger = Box({ style: { width: 40, height: 20 } });
      const content = Box({ style: { width: 120, height: 80 } });
      Popover({ trigger, children: content, open });
      expect(reg.list().length).toBe(1);
    });
  });

  it('controlled open:false hides overlay', () => {
    withReg((reg) => {
      const [open] = createSignal(false);
      const trigger = Box({ style: { width: 40, height: 20 } });
      const content = Box({ style: { width: 120, height: 80 } });
      Popover({ trigger, children: content, open });
      expect(reg.list().length).toBe(0);
    });
  });

  it('controlled: toggling signal updates overlay count', () => {
    withReg((reg) => {
      const [open, setOpen] = createSignal(false);
      const trigger = Box({ style: { width: 40, height: 20 } });
      const content = Box({ style: { width: 120, height: 80 } });
      Popover({ trigger, children: content, open });
      expect(reg.list().length).toBe(0);
      setOpen(true);
      expect(reg.list().length).toBe(1);
      setOpen(false);
      expect(reg.list().length).toBe(0);
    });
  });

  it('controlled: trigger click calls onOpenChange instead of toggling internally', () => {
    withReg((reg) => {
      let reported: boolean | undefined;
      const [open] = createSignal(false);
      const trigger = Box({ style: { width: 40, height: 20 } });
      const content = Box({ style: { width: 120, height: 80 } });
      Popover({ trigger, children: content, open, onOpenChange: (v) => { reported = v; } });
      trigger.handlers!.onClick?.({} as any);
      expect(reported).toBe(true); // requested open=true
      expect(reg.list().length).toBe(0); // still closed (controlled)
    });
  });
});

describe('Popover — onOpenChange', () => {
  it('uncontrolled: onOpenChange fires with new open value on toggle', () => {
    withReg((reg) => {
      const reported: boolean[] = [];
      const trigger = Box({ style: { width: 40, height: 20 } });
      const content = Box({ style: { width: 120, height: 80 } });
      const inst = Popover({ trigger, children: content, onOpenChange: (v) => reported.push(v) });
      reg.setAppRoot(inst);
      trigger.handlers!.onClick?.({} as any); // open
      expect(reported).toEqual([true]);
      trigger.handlers!.onClick?.({} as any); // close
      expect(reported).toEqual([true, false]);
    });
  });
});
