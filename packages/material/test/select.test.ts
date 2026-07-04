import { describe, it, expect, vi } from 'vitest';
import { createRoot, runWithContext } from '@cairn/reactivity';
import { overlayContext, createOverlayRegistry, hostContext } from '@cairn/runtime';
import { themeContext } from '@cairn/style';
import { selectContext } from '@cairn/widgets';
import { Select, Option } from '../src/select';
import { createMaterialTheme } from '../src/theme';

function fakeHost() {
  const host: any = {
    scheduler: {
      requestFrame(_cb: any) { return 1; },
      cancelFrame() {},
    },
    renderer: {},
    metrics: { width: 800, height: 600 },
    input: {},
  };
  return host;
}

function withContext<T>(fn: () => T): T {
  const theme = createMaterialTheme();
  const reg = createOverlayRegistry();
  return createRoot(() =>
    runWithContext(overlayContext, reg, () =>
      runWithContext(hostContext, fakeHost(), () =>
        runWithContext(themeContext, () => theme as any, fn),
      ),
    ),
  );
}

function withReg<T>(fn: (reg: ReturnType<typeof createOverlayRegistry>) => T): T {
  const theme = createMaterialTheme();
  const reg = createOverlayRegistry();
  return createRoot(() =>
    runWithContext(overlayContext, reg, () =>
      runWithContext(hostContext, fakeHost(), () =>
        runWithContext(themeContext, () => theme as any, () => fn(reg)),
      ),
    ),
  );
}

function fakeSelectCtx(overrides: Partial<ReturnType<typeof makeFakeCtx>> = {}) {
  return { ...makeFakeCtx(), ...overrides };
}

function makeFakeCtx() {
  return {
    value: () => null as any,
    setValue: vi.fn(),
    close: vi.fn(),
    register: vi.fn().mockReturnValue(0),
    selectedLabel: () => '',
    activeIndex: () => -1,
    handleRovingKey: () => false,
  };
}

// ─── renders ─────────────────────────────────────────────────────────────────

describe('Material Select — renders', () => {
  it('creates an instance without errors using options array', () => {
    withContext(() => {
      const inst = Select({
        label: 'Fruit',
        options: [{ value: 'apple', label: 'Apple' }],
      });
      expect(inst).toBeTruthy();
    });
  });

  it('creates an instance without errors using children factory', () => {
    withContext(() => {
      const inst = Select({
        label: 'Fruit',
        children: () => {
          const theme = createMaterialTheme();
          return runWithContext(themeContext, () => theme as any, () =>
            runWithContext(selectContext.context, fakeSelectCtx(), () =>
              Option({ value: 'apple', label: 'Apple' }),
            ),
          );
        },
      });
      expect(inst).toBeTruthy();
    });
  });

  it('trigger has combobox role in semantics', () => {
    withContext(() => {
      const inst = Select({
        label: 'Fruit',
        options: [{ value: 'apple', label: 'Apple' }],
      });
      expect((inst as any).semantics?.role).toBe('combobox');
    });
  });

  it('trigger is focusable', () => {
    withContext(() => {
      const inst = Select({
        label: 'Fruit',
        options: [{ value: 'apple', label: 'Apple' }],
      });
      expect(inst.focusable).toBe(true);
    });
  });

  it('renders with no options (empty select)', () => {
    withContext(() => {
      const inst = Select({ options: [] });
      expect(inst).toBeTruthy();
    });
  });
});

// ─── disabled ────────────────────────────────────────────────────────────────

describe('Material Select — disabled', () => {
  it('disabled select does not open on click', () => {
    withReg((reg) => {
      const inst = Select({
        label: 'Fruit',
        options: [{ value: 'a', label: 'A' }],
        disabled: true,
      });
      reg.setAppRoot(inst);
      inst.handlers?.onClick?.({} as any);
      expect(reg.list().length).toBe(0);
    });
  });

  it('disabled select has disabled in semantics', () => {
    withContext(() => {
      const inst = Select({
        label: 'Fruit',
        options: [{ value: 'a', label: 'A' }],
        disabled: true,
      });
      expect((inst as any).semantics?.disabled).toBe(true);
    });
  });

  it('disabled select is not focusable', () => {
    withContext(() => {
      const inst = Select({
        label: 'Fruit',
        options: [{ value: 'a', label: 'A' }],
        disabled: true,
      });
      expect(inst.focusable).toBe(false);
    });
  });
});

// ─── onChange pass-through ────────────────────────────────────────────────────

describe('Material Select — onChange pass-through', () => {
  it('onChange is called when Option is selected', () => {
    withContext(() => {
      const onChange = vi.fn();
      const ctx: ReturnType<typeof makeFakeCtx> = {
        ...makeFakeCtx(),
        setValue: vi.fn((v: any) => { onChange(v); }),
      };
      const theme = createMaterialTheme();
      let optInst: any;
      runWithContext(selectContext.context, ctx, () =>
        runWithContext(themeContext, () => theme as any, () => {
          optInst = Option({ value: 'apple', label: 'Apple' });
        }),
      );
      optInst.handlers?.onClick?.({ stopPropagation: vi.fn() } as any);
      expect(onChange).toHaveBeenCalledWith('apple');
    });
  });

  it('disabled Option does not call onChange', () => {
    withContext(() => {
      const onChange = vi.fn();
      const ctx: ReturnType<typeof makeFakeCtx> = {
        ...makeFakeCtx(),
        setValue: vi.fn(onChange),
      };
      const theme = createMaterialTheme();
      let optInst: any;
      runWithContext(selectContext.context, ctx, () =>
        runWithContext(themeContext, () => theme as any, () => {
          optInst = Option({ value: 'apple', label: 'Apple', disabled: true });
        }),
      );
      optInst.handlers?.onClick?.({ stopPropagation: vi.fn() } as any);
      expect(onChange).not.toHaveBeenCalled();
    });
  });
});

// ─── open / close ────────────────────────────────────────────────────────────

describe('Material Select — open / close', () => {
  it('starts closed (no overlay registered)', () => {
    withReg((reg) => {
      Select({
        label: 'Fruit',
        options: [{ value: 'apple', label: 'Apple' }],
      });
      expect(reg.list().length).toBe(0);
    });
  });

  it('clicking trigger opens the menu (one overlay)', () => {
    withReg((reg) => {
      const inst = Select({
        label: 'Fruit',
        options: [{ value: 'apple', label: 'Apple' }],
      });
      reg.setAppRoot(inst);
      inst.handlers?.onClick?.({} as any);
      expect(reg.list().length).toBe(1);
    });
  });

  it('clicking trigger again closes the menu', () => {
    withReg((reg) => {
      const inst = Select({
        label: 'Fruit',
        options: [{ value: 'apple', label: 'Apple' }],
      });
      reg.setAppRoot(inst);
      inst.handlers?.onClick?.({} as any);
      expect(reg.list().length).toBe(1);
      inst.handlers?.onClick?.({} as any);
      expect(reg.list().length).toBe(0);
    });
  });

  it('ArrowDown key opens the select', () => {
    withReg((reg) => {
      const inst = Select({
        label: 'Fruit',
        options: [{ value: 'apple', label: 'Apple' }],
      });
      reg.setAppRoot(inst);
      inst.handlers?.onKeyDown?.({ key: 'ArrowDown', preventDefault: vi.fn() } as any);
      expect(reg.list().length).toBe(1);
    });
  });
});

// ─── trigger structure ────────────────────────────────────────────────────────

describe('Material Select — trigger structure', () => {
  it('trigger has handlers', () => {
    withContext(() => {
      const inst = Select({
        label: 'Fruit',
        options: [{ value: 'apple', label: 'Apple' }],
      });
      expect(inst.handlers).toBeDefined();
    });
  });

  it('trigger expanded starts false', () => {
    withContext(() => {
      const inst = Select({
        label: 'Fruit',
        options: [{ value: 'apple', label: 'Apple' }],
      });
      expect((inst as any).semantics?.expanded).toBe(false);
    });
  });

  it('has children (trigger visual content)', () => {
    withContext(() => {
      const inst = Select({
        label: 'Fruit',
        options: [{ value: 'apple', label: 'Apple' }],
      });
      expect(inst.children.length).toBeGreaterThan(0);
    });
  });
});

// ─── Material.Option ─────────────────────────────────────────────────────────

describe('Material Option — renders', () => {
  it('creates an instance without errors', () => {
    withContext(() => {
      const ctx = fakeSelectCtx();
      const theme = createMaterialTheme();
      let optInst: any;
      runWithContext(selectContext.context, ctx, () =>
        runWithContext(themeContext, () => theme as any, () => {
          optInst = Option({ value: 'apple', label: 'Apple' });
        }),
      );
      expect(optInst).toBeTruthy();
    });
  });

  it('has role option in semantics', () => {
    withContext(() => {
      const ctx = fakeSelectCtx();
      const theme = createMaterialTheme();
      let optInst: any;
      runWithContext(selectContext.context, ctx, () =>
        runWithContext(themeContext, () => theme as any, () => {
          optInst = Option({ value: 'apple', label: 'Apple' });
        }),
      );
      expect(optInst.semantics?.role).toBe('option');
    });
  });

  it('has label set from props', () => {
    withContext(() => {
      const ctx = fakeSelectCtx();
      const theme = createMaterialTheme();
      let optInst: any;
      runWithContext(selectContext.context, ctx, () =>
        runWithContext(themeContext, () => theme as any, () => {
          optInst = Option({ value: 'banana', label: 'Banana' });
        }),
      );
      expect(optInst.semantics?.label).toBe('Banana');
    });
  });

  it('selected option has selected=true in semantics', () => {
    withContext(() => {
      const ctx = fakeSelectCtx({ value: () => 'apple' });
      const theme = createMaterialTheme();
      let optInst: any;
      runWithContext(selectContext.context, ctx, () =>
        runWithContext(themeContext, () => theme as any, () => {
          optInst = Option({ value: 'apple', label: 'Apple' });
        }),
      );
      expect(optInst.semantics?.selected).toBe(true);
    });
  });

  it('unselected option has selected=false in semantics', () => {
    withContext(() => {
      const ctx = fakeSelectCtx({ value: () => 'apple' });
      const theme = createMaterialTheme();
      let optInst: any;
      runWithContext(selectContext.context, ctx, () =>
        runWithContext(themeContext, () => theme as any, () => {
          optInst = Option({ value: 'banana', label: 'Banana' });
        }),
      );
      expect(optInst.semantics?.selected).toBe(false);
    });
  });

  it('disabled option is marked disabled in semantics', () => {
    withContext(() => {
      const ctx = fakeSelectCtx();
      const theme = createMaterialTheme();
      let optInst: any;
      runWithContext(selectContext.context, ctx, () =>
        runWithContext(themeContext, () => theme as any, () => {
          optInst = Option({ value: 'apple', label: 'Apple', disabled: true });
        }),
      );
      expect(optInst.semantics?.disabled).toBe(true);
    });
  });

  it('onActivate selects value and closes', () => {
    withContext(() => {
      const setValue = vi.fn();
      const close = vi.fn();
      const ctx = fakeSelectCtx({ setValue, close });
      const theme = createMaterialTheme();
      let optInst: any;
      runWithContext(selectContext.context, ctx, () =>
        runWithContext(themeContext, () => theme as any, () => {
          optInst = Option({ value: 'cherry', label: 'Cherry' });
        }),
      );
      optInst.semantics?.onActivate?.();
      expect(setValue).toHaveBeenCalledWith('cherry');
      expect(close).toHaveBeenCalledTimes(1);
    });
  });
});

// ─── color prop ───────────────────────────────────────────────────────────────

describe('Material Select — color prop', () => {
  it('accepts color="secondary" without error', () => {
    withContext(() => {
      const inst = Select({
        label: 'Fruit',
        options: [{ value: 'a', label: 'A' }],
        color: 'secondary',
      });
      expect(inst).toBeTruthy();
    });
  });
});

// ─── fullWidth prop ───────────────────────────────────────────────────────────

describe('Material Select — fullWidth prop', () => {
  it('accepts fullWidth without error', () => {
    withContext(() => {
      const inst = Select({
        label: 'Fruit',
        options: [{ value: 'a', label: 'A' }],
        fullWidth: true,
      });
      expect(inst).toBeTruthy();
    });
  });
});
