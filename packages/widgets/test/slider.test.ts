import { describe, it, expect, vi } from 'vitest';
import { createRoot, createSignal, runWithContext } from '@cairn/reactivity';
import { themeContext } from '@cairn/style';
import { Slider } from '../src/slider';
import { defaultTheme } from '../src/theme';

function withTheme(fn: () => void) {
  createRoot(() => {
    runWithContext(themeContext, () => defaultTheme, fn);
  });
}

// ─── Controlled / uncontrolled ────────────────────────────────────────────────

describe('Slider — controlled/uncontrolled', () => {
  it('uncontrolled: defaultValue is used as initial now in semantics', () => {
    withTheme(() => {
      const inst = Slider({ defaultValue: 42, min: 0, max: 100 });
      expect((inst as any).semantics?.now).toBe(42);
    });
  });

  it('controlled: value accessor drives semantics.now', () => {
    withTheme(() => {
      const [val, setVal] = createSignal(30);
      const inst = Slider({ value: val, min: 0, max: 100 });
      expect((inst as any).semantics?.now).toBe(30);
      setVal(70);
      expect((inst as any).semantics?.now).toBe(70);
    });
  });
});

// ─── clamp + snap ─────────────────────────────────────────────────────────────

describe('Slider — clamp+snap', () => {
  it('clamps value below min to min', () => {
    withTheme(() => {
      const seen: number[] = [];
      const inst = Slider({ defaultValue: 50, min: 0, max: 100, onChange: (v) => seen.push(v) });
      // drive pointer below 0 (localX far left)
      inst.handlers!.onPointerDown!({ localX: -20 } as any);
      expect(seen[0]).toBe(0);
    });
  });

  it('clamps value above max to max', () => {
    withTheme(() => {
      const seen: number[] = [];
      // Need a known track width — we test via semantics: max=50, pointer at extreme right
      // We can't know track width without layout, so test via keyboard End key instead.
      const inst = Slider({ defaultValue: 40, min: 0, max: 50, onChange: (v) => seen.push(v) });
      const sem = (inst as any).semantics;
      const noMods = { shift: false, ctrl: false, alt: false, meta: false };
      sem.onKeyDown('End', noMods);
      expect(seen[0]).toBe(50);
    });
  });

  it('snaps to nearest step', () => {
    withTheme(() => {
      const seen: number[] = [];
      // step=10, starting at 23 → ArrowRight → 33 → snap → 30
      const [val, setVal] = createSignal(23);
      const inst = Slider({ value: val, min: 0, max: 100, step: 10, onChange: (v) => { setVal(v); seen.push(v); } });
      const sem = (inst as any).semantics;
      const noMods = { shift: false, ctrl: false, alt: false, meta: false };
      sem.onKeyDown('ArrowRight', noMods);
      // 23 + 10 = 33 → snap to nearest 10-step from 0 → round(33/10)*10 = round(3.3)*10 = 30
      expect(seen[0]).toBe(30);
    });
  });
});

// ─── Keyboard ─────────────────────────────────────────────────────────────────

describe('Slider — keyboard (semantics.onKeyDown)', () => {
  function makeSlider(initial = 50, step = 1, min = 0, max = 100) {
    let inst: any;
    const seen: number[] = [];
    const [val, setVal] = createSignal(initial);
    inst = Slider({ value: val, min, max, step, onChange: (v) => { setVal(v); seen.push(v); } });
    const sem = inst.semantics!;
    const noMods = { shift: false, ctrl: false, alt: false, meta: false };
    return { inst, sem, seen, noMods };
  }

  it('ArrowRight adjusts by +step, returns true', () => {
    withTheme(() => {
      const { sem, seen, noMods } = makeSlider(50);
      const result = sem.onKeyDown('ArrowRight', noMods);
      expect(result).toBe(true);
      expect(seen[0]).toBe(51);
    });
  });

  it('ArrowLeft adjusts by -step, returns true', () => {
    withTheme(() => {
      const { sem, seen, noMods } = makeSlider(50);
      const result = sem.onKeyDown('ArrowLeft', noMods);
      expect(result).toBe(true);
      expect(seen[0]).toBe(49);
    });
  });

  it('ArrowUp adjusts by +step, returns true', () => {
    withTheme(() => {
      const { sem, seen, noMods } = makeSlider(50);
      const result = sem.onKeyDown('ArrowUp', noMods);
      expect(result).toBe(true);
      expect(seen[0]).toBe(51);
    });
  });

  it('ArrowDown adjusts by -step, returns true', () => {
    withTheme(() => {
      const { sem, seen, noMods } = makeSlider(50);
      const result = sem.onKeyDown('ArrowDown', noMods);
      expect(result).toBe(true);
      expect(seen[0]).toBe(49);
    });
  });

  it('Home sets to min, returns true', () => {
    withTheme(() => {
      const { sem, seen, noMods } = makeSlider(50);
      const result = sem.onKeyDown('Home', noMods);
      expect(result).toBe(true);
      expect(seen[0]).toBe(0);
    });
  });

  it('End sets to max, returns true', () => {
    withTheme(() => {
      const { sem, seen, noMods } = makeSlider(50);
      const result = sem.onKeyDown('End', noMods);
      expect(result).toBe(true);
      expect(seen[0]).toBe(100);
    });
  });

  it('PageUp adjusts by +10% span, returns true', () => {
    withTheme(() => {
      const { sem, seen, noMods } = makeSlider(50, 1, 0, 100);
      const result = sem.onKeyDown('PageUp', noMods);
      expect(result).toBe(true);
      expect(seen[0]).toBe(60);
    });
  });

  it('PageDown adjusts by -10% span, returns true', () => {
    withTheme(() => {
      const { sem, seen, noMods } = makeSlider(50, 1, 0, 100);
      const result = sem.onKeyDown('PageDown', noMods);
      expect(result).toBe(true);
      expect(seen[0]).toBe(40);
    });
  });

  it('unknown key returns false', () => {
    withTheme(() => {
      const { sem, noMods } = makeSlider(50);
      const result = sem.onKeyDown('Tab', noMods);
      expect(result).toBe(false);
    });
  });
});

// ─── Semantics ────────────────────────────────────────────────────────────────

describe('Slider — semantics', () => {
  it('has role slider', () => {
    withTheme(() => {
      const inst = Slider({ defaultValue: 50, min: 0, max: 100 });
      expect((inst as any).semantics?.role).toBe('slider');
    });
  });

  it('semantics.now reflects current value', () => {
    withTheme(() => {
      const [val, setVal] = createSignal(25);
      const inst = Slider({ value: val, min: 0, max: 100 });
      expect((inst as any).semantics?.now).toBe(25);
      setVal(75);
      expect((inst as any).semantics?.now).toBe(75);
    });
  });

  it('semantics.min and max are set from props', () => {
    withTheme(() => {
      const inst = Slider({ defaultValue: 5, min: 2, max: 80 });
      expect((inst as any).semantics?.min).toBe(2);
      expect((inst as any).semantics?.max).toBe(80);
    });
  });

  it('disabled slider has semantics.disabled true and focusable false', () => {
    withTheme(() => {
      const inst = Slider({ defaultValue: 50, min: 0, max: 100, disabled: true });
      expect((inst as any).semantics?.disabled).toBe(true);
      expect((inst as any).semantics?.focusable).toBe(false);
    });
  });

  it('non-disabled slider has semantics.focusable true', () => {
    withTheme(() => {
      const inst = Slider({ defaultValue: 50, min: 0, max: 100 });
      expect((inst as any).semantics?.focusable).toBe(true);
    });
  });

  it('semantics.label reflects props.label', () => {
    withTheme(() => {
      const inst = Slider({ defaultValue: 50, min: 0, max: 100, label: 'Volume' });
      expect((inst as any).semantics?.label).toBe('Volume');
    });
  });
});

// ─── Disabled ─────────────────────────────────────────────────────────────────

describe('Slider — disabled', () => {
  it('disabled: pointer events do not change value', () => {
    withTheme(() => {
      const seen: number[] = [];
      const inst = Slider({ defaultValue: 50, min: 0, max: 100, disabled: true, onChange: (v) => seen.push(v) });
      inst.handlers!.onPointerDown!({ localX: 80 } as any);
      expect(seen).toEqual([]);
    });
  });

  it('disabled: keyboard does not change value', () => {
    withTheme(() => {
      const seen: number[] = [];
      const inst = Slider({ defaultValue: 50, min: 0, max: 100, disabled: true, onChange: (v) => seen.push(v) });
      const sem = (inst as any).semantics;
      const noMods = { shift: false, ctrl: false, alt: false, meta: false };
      sem.onKeyDown('ArrowRight', noMods);
      expect(seen).toEqual([]);
    });
  });
});
