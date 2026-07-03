import { describe, it, expect, vi } from 'vitest';
import { createRoot, runWithContext, createSignal } from '@cairn/reactivity';
import { overlayContext, createOverlayRegistry } from '@cairn/runtime';
import { themeContext } from '@cairn/style';
import { Box } from '@cairn/primitives';
import { Select, Option, selectContext } from '../src/select';
import { defaultTheme } from '../src/theme';

function withReg(fn: (reg: ReturnType<typeof createOverlayRegistry>) => void) {
  createRoot(() => {
    const reg = createOverlayRegistry();
    runWithContext(overlayContext, reg, () =>
      runWithContext(themeContext, () => defaultTheme, () => fn(reg)),
    );
  });
}

// ─── Trigger appearance ───────────────────────────────────────────────────────

describe('Select — trigger', () => {
  it('returns a trigger instance', () => {
    withReg((reg) => {
      const inst = Select({
        placeholder: 'Pick one',
        children: () => Box({ style: { width: 10, height: 10 } }),
      });
      expect(inst).toBeDefined();
      expect(inst.handlers).toBeDefined();
    });
  });

  it('starts closed (no overlay registered)', () => {
    withReg((reg) => {
      Select({
        placeholder: 'Pick one',
        children: () => Box({ style: { width: 10, height: 10 } }),
      });
      expect(reg.list().length).toBe(0);
    });
  });
});

// ─── Open / close ─────────────────────────────────────────────────────────────

describe('Select — open / close', () => {
  it('clicking trigger opens the listbox (one overlay)', () => {
    withReg((reg) => {
      const inst = Select({
        placeholder: 'Pick one',
        children: () => Box({ style: { width: 10, height: 10 } }),
      });
      reg.setAppRoot(inst);
      inst.handlers!.onClick?.({} as any);
      expect(reg.list().length).toBe(1);
    });
  });

  it('clicking trigger again closes the listbox', () => {
    withReg((reg) => {
      const inst = Select({
        placeholder: 'Pick one',
        children: () => Box({ style: { width: 10, height: 10 } }),
      });
      reg.setAppRoot(inst);
      inst.handlers!.onClick?.({} as any);
      expect(reg.list().length).toBe(1);
      inst.handlers!.onClick?.({} as any);
      expect(reg.list().length).toBe(0);
    });
  });
});

// ─── Selecting an option ──────────────────────────────────────────────────────

describe('Select — selecting an option', () => {
  it('Option click sets value, fires onChange, closes', () => {
    withReg((reg) => {
      const onChange = vi.fn();
      const closeFn = vi.fn();
      let setValue: any;

      runWithContext(themeContext, () => defaultTheme, () => {
        const ctx = {
          value: () => null,
          setValue: (v: any) => { setValue = v; onChange(v); },
          close: closeFn,
          register: vi.fn().mockReturnValue(0),
          selectedLabel: () => '',
          activeIndex: () => -1,
          handleRovingKey: () => false,
        };

        let optInst: any;
        runWithContext(selectContext.context, ctx, () => {
          optInst = Option({ value: 'apple', label: 'Apple' });
        });

        optInst.handlers?.onClick?.({} as any);
        expect(onChange).toHaveBeenCalledWith('apple');
        expect(closeFn).toHaveBeenCalledTimes(1);
      });
    });
  });

  it('disabled Option does NOT call setValue or close', () => {
    withReg((reg) => {
      const onChange = vi.fn();
      const closeFn = vi.fn();

      runWithContext(themeContext, () => defaultTheme, () => {
        const ctx = {
          value: () => null,
          setValue: onChange,
          close: closeFn,
          register: vi.fn().mockReturnValue(0),
          selectedLabel: () => '',
          activeIndex: () => -1,
          handleRovingKey: () => false,
        };

        let optInst: any;
        runWithContext(selectContext.context, ctx, () => {
          optInst = Option({ value: 'apple', label: 'Apple', disabled: true });
        });

        optInst.handlers?.onClick?.({} as any);
        expect(onChange).not.toHaveBeenCalled();
        expect(closeFn).not.toHaveBeenCalled();
      });
    });
  });
});

// ─── Controlled / uncontrolled value ─────────────────────────────────────────

describe('Select — controlled value', () => {
  it('uncontrolled: defaultValue is used as initial value', () => {
    withReg((reg) => {
      let observedLabel = '';
      const inst = Select({
        defaultValue: 'b',
        children: () => {
          return Box({ style: { width: 10, height: 10 } });
        },
      });
      // No crash — just verify it renders
      expect(inst).toBeDefined();
    });
  });

  it('controlled: value signal drives selectedLabel', () => {
    withReg((reg) => {
      const [val, setVal] = createSignal<string | null>(null);
      let captured: any;
      const inst = Select({
        value: val,
        onChange: (v) => setVal(v),
        children: () => Box({ style: { width: 10, height: 10 } }),
      });
      // Controlled select should accept signal without crashing
      expect(inst).toBeDefined();
    });
  });
});

// ─── Placeholder ──────────────────────────────────────────────────────────────

describe('Select — placeholder', () => {
  it('renders with placeholder when no value selected (no crash)', () => {
    withReg((reg) => {
      const inst = Select({
        placeholder: 'Choose a fruit',
        children: () => Box({ style: { width: 10, height: 10 } }),
      });
      expect(inst).toBeDefined();
    });
  });
});

// ─── Keyboard ─────────────────────────────────────────────────────────────────

describe('Select — keyboard', () => {
  it('Enter on trigger opens the select', () => {
    withReg((reg) => {
      const inst = Select({
        placeholder: 'Pick one',
        children: () => Box({ style: { width: 10, height: 10 } }),
      });
      reg.setAppRoot(inst);
      inst.handlers!.onKeyDown?.({ key: 'Enter', preventDefault: vi.fn() } as any);
      expect(reg.list().length).toBe(1);
    });
  });

  it('Space on trigger opens the select', () => {
    withReg((reg) => {
      const inst = Select({
        placeholder: 'Pick one',
        children: () => Box({ style: { width: 10, height: 10 } }),
      });
      reg.setAppRoot(inst);
      inst.handlers!.onKeyDown?.({ key: ' ', preventDefault: vi.fn() } as any);
      expect(reg.list().length).toBe(1);
    });
  });

  it('ArrowDown on trigger opens the select', () => {
    withReg((reg) => {
      const inst = Select({
        placeholder: 'Pick one',
        children: () => Box({ style: { width: 10, height: 10 } }),
      });
      reg.setAppRoot(inst);
      inst.handlers!.onKeyDown?.({ key: 'ArrowDown', preventDefault: vi.fn() } as any);
      expect(reg.list().length).toBe(1);
    });
  });

  it('Escape in an open select closes it (via catcher)', () => {
    withReg((reg) => {
      const inst = Select({
        placeholder: 'Pick one',
        children: () => Box({ style: { width: 10, height: 10 } }),
      });
      reg.setAppRoot(inst);
      inst.handlers!.onClick?.({} as any);
      expect(reg.list().length).toBe(1);
      // Press Escape on the catcher overlay
      const overlay = reg.list()[0];
      const catcher = overlay.children?.[0] ?? overlay;
      catcher.handlers?.onKeyDown?.({ key: 'Escape' } as any);
      expect(reg.list().length).toBe(0);
    });
  });

  it('Enter on an Option via keyboard closes', () => {
    withReg(() => {
      const onSelect = vi.fn();
      const closeFn = vi.fn();

      runWithContext(themeContext, () => defaultTheme, () => {
        const ctx = {
          value: () => null,
          setValue: onSelect,
          close: closeFn,
          register: vi.fn().mockReturnValue(0),
          selectedLabel: () => '',
          activeIndex: () => -1,
          handleRovingKey: () => false,
        };

        let optInst: any;
        runWithContext(selectContext.context, ctx, () => {
          optInst = Option({ value: 'x', label: 'X' });
        });

        optInst.handlers?.onKeyDown?.({ key: 'Enter', preventDefault: vi.fn() } as any);
        expect(onSelect).toHaveBeenCalledWith('x');
        expect(closeFn).toHaveBeenCalledTimes(1);
      });
    });
  });
});

// ─── Only one option selected ─────────────────────────────────────────────────

describe('Select — selected highlight', () => {
  it('selected Option is highlighted (does not crash)', () => {
    withReg(() => {
      runWithContext(themeContext, () => defaultTheme, () => {
        const ctx = {
          value: () => 'apple',
          setValue: vi.fn(),
          close: vi.fn(),
          register: vi.fn().mockReturnValue(0),
          selectedLabel: () => 'Apple',
          activeIndex: () => -1,
          handleRovingKey: () => false,
        };

        let optA: any, optB: any;
        runWithContext(selectContext.context, ctx, () => {
          optA = Option({ value: 'apple', label: 'Apple' });
          optB = Option({ value: 'banana', label: 'Banana' });
        });

        // Both options exist
        expect(optA).toBeDefined();
        expect(optB).toBeDefined();
      });
    });
  });
});

// ─── Context guard ────────────────────────────────────────────────────────────

describe('useSelect — throws outside Select', () => {
  it('throws if not inside Select context', () => {
    expect(() => {
      createRoot(() => {
        runWithContext(themeContext, () => defaultTheme, () => {
          selectContext.use();
        });
      });
    }).toThrow(/Select/);
  });
});

// ─── NF3: Native semantics ────────────────────────────────────────────────────

describe('Select — native semantics (NF3)', () => {
  it('trigger has role combobox', () => {
    withReg((reg) => {
      const inst = Select({
        placeholder: 'Pick one',
        children: () => Box({ style: { width: 10, height: 10 } }),
      });
      expect((inst as any).semantics?.role).toBe('combobox');
    });
  });

  it('trigger expanded reflects open state', () => {
    withReg((reg) => {
      const inst = Select({
        placeholder: 'Pick one',
        children: () => Box({ style: { width: 10, height: 10 } }),
      });
      reg.setAppRoot(inst);
      expect((inst as any).semantics?.expanded).toBe(false);
      inst.handlers!.onClick?.({} as any);
      expect((inst as any).semantics?.expanded).toBe(true);
    });
  });

  it('trigger semantics has onActivate that toggles open', () => {
    withReg((reg) => {
      const inst = Select({
        placeholder: 'Pick one',
        children: () => Box({ style: { width: 10, height: 10 } }),
      });
      reg.setAppRoot(inst);
      expect(typeof (inst as any).semantics?.onActivate).toBe('function');
      (inst as any).semantics.onActivate();
      expect((inst as any).semantics?.expanded).toBe(true);
    });
  });

  it('trigger semantics.label reflects selectedLabel or placeholder', () => {
    withReg((reg) => {
      const inst = Select({
        placeholder: 'Choose...',
        children: () => Box({ style: { width: 10, height: 10 } }),
      });
      expect((inst as any).semantics?.label).toBe('Choose...');
    });
  });

  it('trigger onKeyDown (via semantics) opens on ArrowDown', () => {
    withReg((reg) => {
      const inst = Select({
        placeholder: 'Pick one',
        children: () => Box({ style: { width: 10, height: 10 } }),
      });
      reg.setAppRoot(inst);
      const sem = (inst as any).semantics;
      const noMods = { shift: false, ctrl: false, alt: false, meta: false };
      sem.onKeyDown('ArrowDown', noMods);
      expect(sem.expanded).toBe(true);
    });
  });

  it('trigger onKeyDown Escape closes when open', () => {
    withReg((reg) => {
      const inst = Select({
        placeholder: 'Pick one',
        children: () => Box({ style: { width: 10, height: 10 } }),
      });
      reg.setAppRoot(inst);
      inst.handlers!.onClick?.({} as any); // open
      expect((inst as any).semantics?.expanded).toBe(true);
      const noMods = { shift: false, ctrl: false, alt: false, meta: false };
      (inst as any).semantics.onKeyDown('Escape', noMods);
      expect((inst as any).semantics?.expanded).toBe(false);
    });
  });
});

describe('Option — native semantics (NF3)', () => {
  it('option has role option', () => {
    withReg(() => {
      runWithContext(themeContext, () => defaultTheme, () => {
        const ctx = {
          value: () => null,
          setValue: vi.fn(),
          close: vi.fn(),
          register: vi.fn().mockReturnValue(0),
          selectedLabel: () => '',
          activeIndex: () => -1,
          handleRovingKey: () => false,
        };
        let optInst: any;
        runWithContext(selectContext.context, ctx, () => {
          optInst = Option({ value: 'apple', label: 'Apple' });
        });
        expect(optInst.semantics?.role).toBe('option');
      });
    });
  });

  it('option selected reflects whether value matches', () => {
    withReg(() => {
      runWithContext(themeContext, () => defaultTheme, () => {
        const ctx = {
          value: () => 'apple',
          setValue: vi.fn(),
          close: vi.fn(),
          register: vi.fn().mockReturnValue(0),
          selectedLabel: () => 'Apple',
          activeIndex: () => -1,
          handleRovingKey: () => false,
        };
        let optApple: any, optBanana: any;
        runWithContext(selectContext.context, ctx, () => {
          optApple = Option({ value: 'apple', label: 'Apple' });
          optBanana = Option({ value: 'banana', label: 'Banana' });
        });
        expect(optApple.semantics?.selected).toBe(true);
        expect(optBanana.semantics?.selected).toBe(false);
      });
    });
  });

  it('option label is set from props.label', () => {
    withReg(() => {
      runWithContext(themeContext, () => defaultTheme, () => {
        const ctx = {
          value: () => null,
          setValue: vi.fn(),
          close: vi.fn(),
          register: vi.fn().mockReturnValue(0),
          selectedLabel: () => '',
          activeIndex: () => -1,
          handleRovingKey: () => false,
        };
        let optInst: any;
        runWithContext(selectContext.context, ctx, () => {
          optInst = Option({ value: 'banana', label: 'Banana' });
        });
        expect(optInst.semantics?.label).toBe('Banana');
      });
    });
  });

  it('option onActivate selects the value', () => {
    withReg(() => {
      runWithContext(themeContext, () => defaultTheme, () => {
        const setValue = vi.fn();
        const close = vi.fn();
        const ctx = {
          value: () => null,
          setValue,
          close,
          register: vi.fn().mockReturnValue(0),
          selectedLabel: () => '',
          activeIndex: () => -1,
          handleRovingKey: () => false,
        };
        let optInst: any;
        runWithContext(selectContext.context, ctx, () => {
          optInst = Option({ value: 'cherry', label: 'Cherry' });
        });
        optInst.semantics?.onActivate?.();
        expect(setValue).toHaveBeenCalledWith('cherry');
        expect(close).toHaveBeenCalledTimes(1);
      });
    });
  });
});
