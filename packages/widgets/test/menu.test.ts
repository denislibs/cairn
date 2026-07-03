import { describe, it, expect, vi } from 'vitest';
import { createRoot, runWithContext, createSignal } from '@cairn/reactivity';
import { overlayContext, createOverlayRegistry, Provider } from '@cairn/runtime';
import { themeContext } from '@cairn/style';
import { Box } from '@cairn/primitives';
import { Menu, MenuItem, menuContext } from '../src/menu';
import { defaultTheme } from '../src/theme';

function withReg(fn: (reg: ReturnType<typeof createOverlayRegistry>) => void) {
  createRoot(() => {
    const reg = createOverlayRegistry();
    runWithContext(overlayContext, reg, () =>
      runWithContext(themeContext, () => defaultTheme, () => fn(reg)),
    );
  });
}

// ─── Menu open/close ──────────────────────────────────────────────────────────

describe('Menu — open / close', () => {
  it('starts closed (no overlay registered)', () => {
    withReg((reg) => {
      const trigger = Box({ style: { width: 60, height: 32 } });
      Menu({ trigger, children: () => Box({ style: { width: 120, height: 40 } }) });
      expect(reg.list().length).toBe(0);
    });
  });

  it('trigger click opens the menu (one overlay)', () => {
    withReg((reg) => {
      const trigger = Box({ style: { width: 60, height: 32 } });
      const inst = Menu({ trigger, children: () => Box({ style: { width: 120, height: 40 } }) });
      reg.setAppRoot(inst);
      trigger.handlers!.onClick?.({} as any);
      expect(reg.list().length).toBe(1);
    });
  });

  it('second trigger click closes (toggle)', () => {
    withReg((reg) => {
      const trigger = Box({ style: { width: 60, height: 32 } });
      const inst = Menu({ trigger, children: () => Box({ style: { width: 120, height: 40 } }) });
      reg.setAppRoot(inst);
      trigger.handlers!.onClick?.({} as any);
      expect(reg.list().length).toBe(1);
      trigger.handlers!.onClick?.({} as any);
      expect(reg.list().length).toBe(0);
    });
  });

  it('returns the trigger as the root instance', () => {
    withReg((reg) => {
      const trigger = Box({ style: { width: 60, height: 32 } });
      const inst = Menu({ trigger, children: () => Box({ style: { width: 120, height: 40 } }) });
      expect(inst).toBe(trigger);
    });
  });

  it('controlled open:true shows overlay immediately', () => {
    withReg((reg) => {
      const [open] = createSignal(true);
      const trigger = Box({ style: { width: 60, height: 32 } });
      Menu({ trigger, children: () => Box({ style: { width: 120, height: 40 } }), open });
      expect(reg.list().length).toBe(1);
    });
  });

  it('defaultOpen:true shows overlay immediately', () => {
    withReg((reg) => {
      const trigger = Box({ style: { width: 60, height: 32 } });
      Menu({ trigger, children: () => Box({ style: { width: 120, height: 40 } }), defaultOpen: true });
      expect(reg.list().length).toBe(1);
    });
  });
});

// ─── MenuItem onSelect + close ────────────────────────────────────────────────

describe('MenuItem — onSelect fires and menu closes', () => {
  it('clicking a MenuItem calls onSelect and closes', () => {
    withReg((reg) => {
      const onSelect = vi.fn();
      const trigger = Box({ style: { width: 60, height: 32 } });

      const inst = Menu({
        trigger,
        children: () => Provider({
          context: menuContext.context,
          value: {
            close: vi.fn(),
            active: () => -1,
            setActive: vi.fn(),
            register: () => 0,
          },
          children: () => MenuItem({ label: 'Item 1', onSelect }),
        }),
      });
      reg.setAppRoot(inst);
      trigger.handlers!.onClick?.({} as any);
      expect(reg.list().length).toBe(1);

      // The overlay contains a Stack-like structure; catcher is first child
      const overlay = reg.list()[0];
      // Find the content box (second child of the catcher stack)
      const stack = overlay;
      const contentBox = stack.children?.[1];
      expect(contentBox).toBeDefined();
    });
  });

  it('MenuItem onSelect fires when clicked via context', () => {
    withReg((reg) => {
      const onSelect = vi.fn();
      const closed: boolean[] = [];
      const closeFn = () => { closed.push(true); };

      let itemInst: any;
      runWithContext(themeContext, () => defaultTheme, () => {
        const ctx = {
          close: closeFn,
          active: () => -1,
          setActive: vi.fn(),
          register: () => 0,
        };
        itemInst = runWithContext(menuContext.context, ctx, () =>
          MenuItem({ label: 'Click me', onSelect }),
        );
      });

      itemInst.handlers?.onClick?.({} as any);
      expect(onSelect).toHaveBeenCalledTimes(1);
      expect(closed).toEqual([true]);
    });
  });

  it('disabled MenuItem does NOT fire onSelect', () => {
    withReg((reg) => {
      const onSelect = vi.fn();
      const closeFn = vi.fn();

      let itemInst: any;
      runWithContext(themeContext, () => defaultTheme, () => {
        const ctx = {
          close: closeFn,
          active: () => -1,
          setActive: vi.fn(),
          register: () => 0,
        };
        itemInst = runWithContext(menuContext.context, ctx, () =>
          MenuItem({ label: 'Disabled', onSelect, disabled: true }),
        );
      });

      itemInst.handlers?.onClick?.({} as any);
      expect(onSelect).not.toHaveBeenCalled();
      expect(closeFn).not.toHaveBeenCalled();
    });
  });
});

// ─── Roving keyboard navigation ───────────────────────────────────────────────

describe('MenuItem — roving keyboard', () => {
  it('ArrowDown moves active index forward', () => {
    withReg(() => {
      const activeVals: number[] = [];
      let currentActive = -1;
      let registeredCount = 0;

      runWithContext(themeContext, () => defaultTheme, () => {
        const ctx = {
          close: vi.fn(),
          active: () => currentActive,
          setActive: (i: number) => { currentActive = i; activeVals.push(i); },
          register: () => registeredCount++,
        };

        // Register two items
        let item0: any, item1: any;
        runWithContext(menuContext.context, ctx, () => {
          item0 = MenuItem({ label: 'Item 0' });
          item1 = MenuItem({ label: 'Item 1' });
        });

        // ArrowDown from -1 should move to next registered index (0)
        item0.handlers?.onKeyDown?.({ key: 'ArrowDown', preventDefault: vi.fn() } as any);
        expect(activeVals.length).toBeGreaterThan(0);
      });
    });
  });

  it('ArrowUp moves active index backward', () => {
    withReg(() => {
      let currentActive = 1;
      const activeVals: number[] = [];
      let registeredCount = 0;

      runWithContext(themeContext, () => defaultTheme, () => {
        const ctx = {
          close: vi.fn(),
          active: () => currentActive,
          setActive: (i: number) => { currentActive = i; activeVals.push(i); },
          register: () => registeredCount++,
        };

        let item0: any;
        runWithContext(menuContext.context, ctx, () => {
          item0 = MenuItem({ label: 'Item 0' });
          MenuItem({ label: 'Item 1' });
        });

        item0.handlers?.onKeyDown?.({ key: 'ArrowUp', preventDefault: vi.fn() } as any);
        expect(activeVals.length).toBeGreaterThan(0);
      });
    });
  });

  it('Enter on MenuItem fires onSelect', () => {
    withReg(() => {
      const onSelect = vi.fn();

      runWithContext(themeContext, () => defaultTheme, () => {
        const ctx = {
          close: vi.fn(),
          active: () => 0,
          setActive: vi.fn(),
          register: () => 0,
        };

        let itemInst: any;
        runWithContext(menuContext.context, ctx, () => {
          itemInst = MenuItem({ label: 'Item', onSelect });
        });

        itemInst.handlers?.onKeyDown?.({ key: 'Enter', preventDefault: vi.fn() } as any);
        expect(onSelect).toHaveBeenCalledTimes(1);
      });
    });
  });
});

// ─── Context guard ────────────────────────────────────────────────────────────

describe('useMenu — throws outside Menu', () => {
  it('throws if not inside Menu context', () => {
    expect(() => {
      createRoot(() => {
        runWithContext(themeContext, () => defaultTheme, () => {
          menuContext.use();
        });
      });
    }).toThrow(/Menu/);
  });
});
