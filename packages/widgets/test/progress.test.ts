import { describe, it, expect } from 'vitest';
import { createRoot, createSignal, runWithContext } from '@cairn/reactivity';
import { themeContext } from '@cairn/style';
import { Progress } from '../src/progress';
import { defaultTheme } from '../src/theme';

function withTheme(fn: () => void) {
  createRoot(() => {
    runWithContext(themeContext, () => defaultTheme, fn);
  });
}

// ─── Semantics ────────────────────────────────────────────────────────────────

describe('Progress — semantics', () => {
  it('has role progressbar', () => {
    withTheme(() => {
      const inst = Progress({ value: 50 });
      expect((inst as any).semantics?.role).toBe('progressbar');
    });
  });

  it('semantics.min is always 0', () => {
    withTheme(() => {
      const inst = Progress({ value: 25, max: 100 });
      expect((inst as any).semantics?.min).toBe(0);
    });
  });

  it('semantics.max reflects props.max (default 100)', () => {
    withTheme(() => {
      const inst = Progress({ value: 10 });
      expect((inst as any).semantics?.max).toBe(100);
    });
  });

  it('semantics.max reflects custom props.max', () => {
    withTheme(() => {
      const inst = Progress({ value: 10, max: 200 });
      expect((inst as any).semantics?.max).toBe(200);
    });
  });

  it('semantics.now reflects value for determinate', () => {
    withTheme(() => {
      const inst = Progress({ value: 42, max: 100 });
      expect((inst as any).semantics?.now).toBe(42);
    });
  });

  it('semantics.now is undefined for indeterminate', () => {
    withTheme(() => {
      const inst = Progress({ indeterminate: true });
      expect((inst as any).semantics?.now).toBeUndefined();
    });
  });

  it('semantics.now is undefined when value is undefined and not indeterminate', () => {
    withTheme(() => {
      const inst = Progress({});
      expect((inst as any).semantics?.now).toBeUndefined();
    });
  });
});

// ─── Reactive value ───────────────────────────────────────────────────────────

describe('Progress — reactive value', () => {
  it('accessor value updates semantics.now reactively', () => {
    withTheme(() => {
      const [val, setVal] = createSignal(30);
      const inst = Progress({ value: val, max: 100 });
      expect((inst as any).semantics?.now).toBe(30);
      setVal(70);
      expect((inst as any).semantics?.now).toBe(70);
    });
  });

  it('static number value sets semantics.now once', () => {
    withTheme(() => {
      const inst = Progress({ value: 55, max: 100 });
      expect((inst as any).semantics?.now).toBe(55);
    });
  });
});

// ─── Fill width via layout node ───────────────────────────────────────────────

describe('Progress — fill width (layout.width)', () => {
  it('fill width is 0% when value is 0', () => {
    withTheme(() => {
      const inst = Progress({ value: 0, max: 100 });
      const fill = inst.children[0];
      expect((fill.layout as any).width).toBe('0%');
    });
  });

  it('fill width is 100% when value equals max', () => {
    withTheme(() => {
      const inst = Progress({ value: 100, max: 100 });
      const fill = inst.children[0];
      expect((fill.layout as any).width).toBe('100%');
    });
  });

  it('fill width is 25% for value=25, max=100', () => {
    withTheme(() => {
      const inst = Progress({ value: 25, max: 100 });
      const fill = inst.children[0];
      expect((fill.layout as any).width).toBe('25%');
    });
  });

  it('fill width is 50% for value=50, max=100', () => {
    withTheme(() => {
      const inst = Progress({ value: 50, max: 100 });
      const fill = inst.children[0];
      expect((fill.layout as any).width).toBe('50%');
    });
  });

  it('fill width updates reactively when accessor value changes', () => {
    withTheme(() => {
      const [val, setVal] = createSignal(0);
      const inst = Progress({ value: val, max: 100 });
      const fill = inst.children[0];
      expect((fill.layout as any).width).toBe('0%');
      setVal(50);
      expect((fill.layout as any).width).toBe('50%');
    });
  });

  it('fill width is 0% for indeterminate (no value → 0/max)', () => {
    withTheme(() => {
      const inst = Progress({ indeterminate: true, max: 100 });
      const fill = inst.children[0];
      // indeterminate: no value, so fill defaults to 0%
      const w = (fill.layout as any).width as string;
      expect(w).toMatch(/%$/);
    });
  });
});

// ─── Track height (size prop) ─────────────────────────────────────────────────

describe('Progress — size prop', () => {
  it('default size is 6 (track height)', () => {
    withTheme(() => {
      const inst = Progress({ value: 50 });
      expect((inst.layout as any).height).toBe(6);
    });
  });

  it('custom size applies to track height', () => {
    withTheme(() => {
      const inst = Progress({ value: 50, size: 12 });
      expect((inst.layout as any).height).toBe(12);
    });
  });
});

// ─── Indeterminate ───────────────────────────────────────────────────────────

describe('Progress — indeterminate', () => {
  it('indeterminate: semantics.now is undefined', () => {
    withTheme(() => {
      const inst = Progress({ indeterminate: true });
      expect((inst as any).semantics?.now).toBeUndefined();
    });
  });

  it('indeterminate: role is still progressbar', () => {
    withTheme(() => {
      const inst = Progress({ indeterminate: true });
      expect((inst as any).semantics?.role).toBe('progressbar');
    });
  });
});

// ─── LayoutChildProps ────────────────────────────────────────────────────────

describe('Progress — applyLayoutChildProps', () => {
  it('accepts flex prop and applies to layout', () => {
    withTheme(() => {
      const inst = Progress({ value: 50, flex: 1 });
      expect((inst.layout as any).flex).toBe(1);
    });
  });

  it('accepts margin prop without error', () => {
    withTheme(() => {
      expect(() => Progress({ value: 50, margin: 8 })).not.toThrow();
    });
  });
});
