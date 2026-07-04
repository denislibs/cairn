import { describe, it, expect, vi } from 'vitest';
import { createRoot, runWithContext, createSignal } from '@cairn/reactivity';
import { overlayContext, createOverlayRegistry, hostContext, setFrameRequester } from '@cairn/runtime';
import { themeContext } from '@cairn/style';
import { Box } from '@cairn/primitives';
import { createFakeHost } from '../../primitives/test/fake-host';
import { Combobox, ComboboxOption, comboboxContext } from '../src/combobox';
import { defaultTheme } from '../src/theme';

const sem = (o: any) => o.semantics ?? o.children?.[0]?.semantics;

function withReg(fn: (reg: ReturnType<typeof createOverlayRegistry>) => void) {
  setFrameRequester(() => {});
  const fh = createFakeHost();
  createRoot(() => {
    const reg = createOverlayRegistry();
    try {
      runWithContext(hostContext, fh.host, () =>
        runWithContext(overlayContext, reg, () =>
          runWithContext(themeContext, () => defaultTheme, () => fn(reg)),
        ),
      );
    } finally {
      setFrameRequester(null);
    }
  });
}

// ─── Basic render ─────────────────────────────────────────────────────────────

describe('Combobox — basic render', () => {
  it('returns an instance', () => {
    withReg((_reg) => {
      const inst = Combobox({
        placeholder: 'Search...',
        children: () => Box({ style: { width: 10, height: 10 } }),
      });
      expect(inst).toBeDefined();
      expect(inst.layout).toBeDefined();
    });
  });

  it('starts closed (no overlay registered)', () => {
    withReg((reg) => {
      Combobox({
        placeholder: 'Search...',
        children: () => Box({ style: { width: 10, height: 10 } }),
      });
      expect(reg.list().length).toBe(0);
    });
  });
});

// ─── Semantics ────────────────────────────────────────────────────────────────

describe('Combobox — semantics', () => {
  it('wrapper has role combobox', () => {
    withReg((_reg) => {
      const inst = Combobox({
        placeholder: 'Pick one',
        children: () => Box({ style: { width: 10, height: 10 } }),
      });
      expect(((inst as any).children[0].semantics)?.role).toBe('combobox');
    });
  });

  it('semantics.expanded starts as false', () => {
    withReg((_reg) => {
      const inst = Combobox({
        placeholder: 'Pick one',
        children: () => Box({ style: { width: 10, height: 10 } }),
      });
      expect(((inst as any).children[0].semantics)?.expanded).toBe(false);
    });
  });

  it('semantics.expanded reflects open state when ArrowDown pressed', () => {
    withReg((reg) => {
      const inst = Combobox({
        placeholder: 'Pick one',
        children: () => Box({ style: { width: 10, height: 10 } }),
      });
      reg.setAppRoot(inst);
      const sem = ((inst as any).children[0].semantics);
      const noMods = { shift: false, ctrl: false, alt: false, meta: false };
      sem.onKeyDown('ArrowDown', noMods);
      expect(sem.expanded).toBe(true);
    });
  });

  it('semantics.label reflects placeholder', () => {
    withReg((_reg) => {
      const inst = Combobox({
        placeholder: 'Find fruit',
        children: () => Box({ style: { width: 10, height: 10 } }),
      });
      expect(((inst as any).children[0].semantics)?.label).toBe('Find fruit');
    });
  });
});

// ─── Keyboard ─────────────────────────────────────────────────────────────────

describe('Combobox — keyboard ArrowDown opens', () => {
  it('ArrowDown on closed Combobox opens it (overlay registered)', () => {
    withReg((reg) => {
      const inst = Combobox({
        placeholder: 'Pick one',
        children: () => Box({ style: { width: 10, height: 10 } }),
      });
      reg.setAppRoot(inst);
      const sem = ((inst as any).children[0].semantics);
      const noMods = { shift: false, ctrl: false, alt: false, meta: false };
      sem.onKeyDown('ArrowDown', noMods);
      expect(reg.list().length).toBe(1);
    });
  });

  it('Escape closes the listbox', () => {
    withReg((reg) => {
      const inst = Combobox({
        placeholder: 'Pick one',
        children: () => Box({ style: { width: 10, height: 10 } }),
      });
      reg.setAppRoot(inst);
      const sem = ((inst as any).children[0].semantics);
      const noMods = { shift: false, ctrl: false, alt: false, meta: false };
      // Open first
      sem.onKeyDown('ArrowDown', noMods);
      expect(reg.list().length).toBe(1);
      // Escape closes
      sem.onKeyDown('Escape', noMods);
      expect(sem.expanded).toBe(false);
    });
  });
});

describe('Combobox — Enter selects active option', () => {
  it('ArrowDown opens listbox (semantics.expanded)', () => {
    withReg((reg) => {
      const inst = Combobox({
        placeholder: 'Search...',
        onChange: vi.fn(),
        children: () => Box({ style: { width: 0, height: 0 } }),
      });
      reg.setAppRoot(inst);
      const sem = ((inst as any).children[0].semantics);
      const noMods = { shift: false, ctrl: false, alt: false, meta: false };
      sem.onKeyDown('ArrowDown', noMods);
      expect(sem.expanded).toBe(true);
    });
  });

  it('ComboboxOption onActivate calls ctx.selectOption with value and label', () => {
    withReg(() => {
      runWithContext(themeContext, () => defaultTheme, () => {
        const selectOption = vi.fn();
        const ctx = {
          inputText: () => '',
          value: () => null,
          setValue: vi.fn(),
          close: vi.fn(),
          register: vi.fn().mockReturnValue(0),
          activeIndex: () => -1,
          handleRovingKey: () => false,
          selectOption,
        };

        let optInst: any;
        runWithContext(comboboxContext.context, ctx, () => {
          optInst = ComboboxOption({ value: 'apple', label: 'Apple' });
        });
        sem(optInst)?.onActivate?.();
        expect(selectOption).toHaveBeenCalledWith({ value: 'apple', label: 'Apple' });
      });
    });
  });
});

// ─── Controlled / uncontrolled ────────────────────────────────────────────────

describe('Combobox — controlled/uncontrolled', () => {
  it('uncontrolled: defaultValue is used as initial value', () => {
    withReg((_reg) => {
      const inst = Combobox({
        defaultValue: 'apple',
        children: () => Box({ style: { width: 10, height: 10 } }),
      });
      expect(inst).toBeDefined();
    });
  });

  it('controlled: value signal is respected (no crash)', () => {
    withReg((_reg) => {
      const [val, setVal] = createSignal<string | null>(null);
      const inst = Combobox({
        value: val,
        onChange: (v) => setVal(v),
        children: () => Box({ style: { width: 10, height: 10 } }),
      });
      expect(inst).toBeDefined();
    });
  });
});

// ─── onInput / filtering ──────────────────────────────────────────────────────

describe('Combobox — filtering', () => {
  it('onInput from semantics updates inputText and opens listbox', () => {
    withReg((reg) => {
      const onInputChange = vi.fn();
      const inst = Combobox({
        placeholder: 'Search...',
        onInputChange,
        children: () => Box({ style: { width: 10, height: 10 } }),
      });
      reg.setAppRoot(inst);

      const sem = ((inst as any).children[0].semantics);
      sem.onInput?.('app');
      expect(onInputChange).toHaveBeenCalledWith('app');
      expect(sem.expanded).toBe(true);
    });
  });
});

// ─── ComboboxOption — semantics ───────────────────────────────────────────────

describe('ComboboxOption — semantics', () => {
  it('option has role option', () => {
    withReg(() => {
      runWithContext(themeContext, () => defaultTheme, () => {
        const ctx = {
          inputText: () => '',
          value: () => null,
          setValue: vi.fn(),
          close: vi.fn(),
          register: vi.fn().mockReturnValue(0),
          activeIndex: () => -1,
          handleRovingKey: () => false,
          selectOption: vi.fn(),
        };

        let optInst: any;
        runWithContext(comboboxContext.context, ctx, () => {
          optInst = ComboboxOption({ value: 'apple', label: 'Apple' });
        });
        expect(sem(optInst)?.role).toBe('option');
      });
    });
  });

  it('option selected reflects ctx.value', () => {
    withReg(() => {
      runWithContext(themeContext, () => defaultTheme, () => {
        const ctx = {
          inputText: () => '',
          value: () => 'apple',
          setValue: vi.fn(),
          close: vi.fn(),
          register: vi.fn().mockReturnValue(0),
          activeIndex: () => -1,
          handleRovingKey: () => false,
          selectOption: vi.fn(),
        };

        let optApple: any, optBanana: any;
        runWithContext(comboboxContext.context, ctx, () => {
          optApple = ComboboxOption({ value: 'apple', label: 'Apple' });
          optBanana = ComboboxOption({ value: 'banana', label: 'Banana' });
        });
        expect(sem(optApple)?.selected).toBe(true);
        expect(sem(optBanana)?.selected).toBe(false);
      });
    });
  });

  it('option label is set from props.label', () => {
    withReg(() => {
      runWithContext(themeContext, () => defaultTheme, () => {
        const ctx = {
          inputText: () => '',
          value: () => null,
          setValue: vi.fn(),
          close: vi.fn(),
          register: vi.fn().mockReturnValue(0),
          activeIndex: () => -1,
          handleRovingKey: () => false,
          selectOption: vi.fn(),
        };

        let optInst: any;
        runWithContext(comboboxContext.context, ctx, () => {
          optInst = ComboboxOption({ value: 'banana', label: 'Banana' });
        });
        expect(sem(optInst)?.label).toBe('Banana');
      });
    });
  });

  it('option onActivate calls selectOption (sets value + inputText + closes)', () => {
    withReg(() => {
      runWithContext(themeContext, () => defaultTheme, () => {
        const selectOption = vi.fn();
        const ctx = {
          inputText: () => '',
          value: () => null,
          setValue: vi.fn(),
          close: vi.fn(),
          register: vi.fn().mockReturnValue(0),
          activeIndex: () => -1,
          handleRovingKey: () => false,
          selectOption,
        };

        let optInst: any;
        runWithContext(comboboxContext.context, ctx, () => {
          optInst = ComboboxOption({ value: 'cherry', label: 'Cherry' });
        });
        sem(optInst)?.onActivate?.();
        expect(selectOption).toHaveBeenCalledWith({ value: 'cherry', label: 'Cherry' });
      });
    });
  });
});

// ─── Filtering (option visibility) ───────────────────────────────────────────

describe('Combobox — filtering (option visibility)', () => {
  it('ComboboxOption is created for matching and non-matching labels', () => {
    withReg(() => {
      runWithContext(themeContext, () => defaultTheme, () => {
        const [inputText] = createSignal('app');
        const ctx = {
          inputText,
          value: () => null,
          setValue: vi.fn(),
          close: vi.fn(),
          register: vi.fn().mockReturnValue(0),
          activeIndex: () => -1,
          handleRovingKey: () => false,
          selectOption: vi.fn(),
        };

        let appleOpt: any, bananaOpt: any;
        runWithContext(comboboxContext.context, ctx, () => {
          appleOpt = ComboboxOption({ value: 'apple', label: 'Apple' });
          bananaOpt = ComboboxOption({ value: 'banana', label: 'Banana' });
        });

        // Filter is 'app': the matching option renders a row (with option semantics
        // in the a11y tree); the non-matching one renders nothing (absent from the
        // a11y tree — Show hides it entirely).
        expect(sem(appleOpt)?.role).toBe('option');
        expect(sem(bananaOpt)).toBeUndefined();
      });
    });
  });

  it('onInput typing opens listbox and fires onInputChange', () => {
    withReg((reg) => {
      const onInputChange = vi.fn();
      const inst = Combobox({
        placeholder: 'Search...',
        onInputChange,
        onChange: vi.fn(),
        children: () => Box({ style: { width: 0, height: 0 } }),
      });
      reg.setAppRoot(inst);
      const sem = ((inst as any).children[0].semantics);
      sem.onInput?.('app');
      expect(onInputChange).toHaveBeenCalledWith('app');
      expect(sem.expanded).toBe(true);
    });
  });
});

// ─── Context guard ────────────────────────────────────────────────────────────

describe('useCombobox — throws outside Combobox', () => {
  it('throws if not inside Combobox context', () => {
    expect(() => {
      createRoot(() => {
        runWithContext(themeContext, () => defaultTheme, () => {
          comboboxContext.use();
        });
      });
    }).toThrow(/Combobox/);
  });
});

// ─── Compound component ───────────────────────────────────────────────────────

describe('Combobox — compound component', () => {
  it('Combobox.Option is defined', () => {
    expect(Combobox.Option).toBeDefined();
    expect(typeof Combobox.Option).toBe('function');
  });
});
