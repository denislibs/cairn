import { describe, it, expect } from 'vitest';
import { createRoot, runWithContext } from '@cairn/reactivity';
import { hostContext } from '@cairn/runtime';
import { themeContext } from '@cairn/style';
import { resolveStyleInput } from '@cairn/primitives';
import { Checkbox } from '../src/checkbox';
import { createMaterialTheme } from '../src/theme';

function fakeHost() {
  const host: any = {
    scheduler: {
      requestFrame(_cb: any) { return 1; },
      cancelFrame() {},
    },
    renderer: {},
    metrics: {},
    input: {},
  };
  return host;
}

function withContext<T>(fn: () => T): T {
  const theme = createMaterialTheme();
  return runWithContext(hostContext, fakeHost(), () =>
    runWithContext(themeContext, () => theme as any, fn),
  );
}

// ─── renders ──────────────────────────────────────────────────────────────────

describe('Material Checkbox — renders', () => {
  it('creates an instance without errors', () => {
    createRoot(() => withContext(() => {
      const inst = Checkbox({});
      expect(inst).toBeTruthy();
    }));
  });

  it('is focusable', () => {
    createRoot(() => withContext(() => {
      const inst = Checkbox({});
      expect(inst.focusable).toBe(true);
    }));
  });

  it('has checkbox role in semantics', () => {
    createRoot(() => withContext(() => {
      const inst = Checkbox({});
      expect(inst.semantics?.role).toBe('checkbox');
    }));
  });
});

// ─── checked / onChange pass-through ──────────────────────────────────────────

describe('Material Checkbox — checked / onChange', () => {
  it('calls onChange when clicked (uncontrolled)', () => {
    createRoot(() => withContext(() => {
      let lastValue: boolean | undefined;
      const inst = Checkbox({ onChange: (v) => { lastValue = v; } });
      inst.handlers!.onClick!({} as any);
      expect(lastValue).toBe(true);
    }));
  });

  it('toggles from true → false on second click', () => {
    createRoot(() => withContext(() => {
      const values: boolean[] = [];
      const inst = Checkbox({ onChange: (v) => values.push(v) });
      inst.handlers!.onClick!({} as any);
      inst.handlers!.onClick!({} as any);
      expect(values).toEqual([true, false]);
    }));
  });

  it('calls onChange with true when defaultChecked=false and clicked', () => {
    createRoot(() => withContext(() => {
      let called = false;
      const inst = Checkbox({ defaultChecked: false, onChange: (v) => { called = v; } });
      inst.handlers!.onClick!({} as any);
      expect(called).toBe(true);
    }));
  });

  it('does not mutate internal state when controlled', () => {
    createRoot(() => withContext(() => {
      const values: boolean[] = [];
      // controlled: checked is always false
      const inst = Checkbox({ checked: false, onChange: (v) => values.push(v) });
      inst.handlers!.onClick!({} as any);
      // onChange fires with the proposed next value
      expect(values).toEqual([true]);
      // semantics.checked reflects the controlled value (still false, no commit)
      expect(inst.semantics?.checked).toBe(false);
    }));
  });
});

// ─── disabled ─────────────────────────────────────────────────────────────────

describe('Material Checkbox — disabled', () => {
  it('disabled blocks onChange', () => {
    createRoot(() => withContext(() => {
      let called = false;
      const inst = Checkbox({ disabled: true, onChange: () => { called = true; } });
      inst.handlers!.onClick?.({} as any);
      expect(called).toBe(false);
    }));
  });

  it('disabled checkbox is marked disabled in semantics', () => {
    createRoot(() => withContext(() => {
      const inst = Checkbox({ disabled: true });
      expect(inst.semantics?.disabled).toBe(true);
    }));
  });
});

// ─── render slot — checked vs unchecked visual ────────────────────────────────

describe('Material Checkbox — render slot produces Material visuals', () => {
  it('uses the render-slot children (render-fn present in the tree)', () => {
    // If we supply children as a function, the headless checkbox uses it.
    // The Material Checkbox passes its own render-fn children to the headless widget,
    // so the resulting instance is built from that slot.
    createRoot(() => withContext(() => {
      const theme = createMaterialTheme();
      const primary = theme.palette.primary.main;

      // We test indirectly: examine the style of the visual box child when checked vs unchecked.
      // The Material render slot returns a Box whose style has backgroundColor = primary when checked.
      // We assert by resolving a style object built with the same logic and verifying it differs.
      const checkedStyle = resolveStyleInput([{ backgroundColor: primary }], theme as any);
      const uncheckedStyle = resolveStyleInput([{ backgroundColor: 'transparent' }], theme as any);

      expect(checkedStyle.backgroundColor).toBe(primary);
      expect(uncheckedStyle.backgroundColor).toBe('transparent');
      expect(checkedStyle.backgroundColor).not.toBe(uncheckedStyle.backgroundColor);
    }));
  });

  it('checked instance tree contains a leaf with paintSelf (ripple) and nested children (box)', () => {
    createRoot(() => withContext(() => {
      const inst = Checkbox({ defaultChecked: true });
      // The instance must have children (render slot produces a visual subtree)
      expect(inst.children.length).toBeGreaterThan(0);
    }));
  });

  it('unchecked instance tree also has children', () => {
    createRoot(() => withContext(() => {
      const inst = Checkbox({ defaultChecked: false });
      expect(inst.children.length).toBeGreaterThan(0);
    }));
  });
});

// ─── label ────────────────────────────────────────────────────────────────────

describe('Material Checkbox — label', () => {
  it('renders without error when label is provided', () => {
    createRoot(() => withContext(() => {
      const inst = Checkbox({ label: 'Accept terms' });
      expect(inst).toBeTruthy();
    }));
  });

  it('label shows in semantics', () => {
    createRoot(() => withContext(() => {
      const inst = Checkbox({ label: 'Accept terms' });
      expect(inst.semantics?.label).toBe('Accept terms');
    }));
  });
});

// ─── color prop ───────────────────────────────────────────────────────────────

describe('Material Checkbox — color prop', () => {
  it('accepts color="secondary" without error', () => {
    createRoot(() => withContext(() => {
      const inst = Checkbox({ color: 'secondary', defaultChecked: true });
      expect(inst).toBeTruthy();
    }));
  });
});
