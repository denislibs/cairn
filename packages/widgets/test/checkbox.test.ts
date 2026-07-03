import { describe, it, expect } from 'vitest';
import { createRoot, createSignal, runWithContext } from '@cairn/reactivity';
import { themeContext } from '@cairn/style';
import { resolveStyleInput } from '@cairn/primitives';
import { Checkbox } from '../src/checkbox';
import { defaultTheme } from '../src/theme';

describe('Checkbox — uncontrolled', () => {
  it('click toggles internal state and fires onChange(true)', () => {
    createRoot(() => {
      const seen: boolean[] = [];
      const inst = Checkbox({ defaultChecked: false, onChange: (v) => seen.push(v) });
      inst.handlers!.onClick!({} as any);
      expect(seen).toEqual([true]);
    });
  });

  it('click again toggles back to false', () => {
    createRoot(() => {
      const seen: boolean[] = [];
      const inst = Checkbox({ defaultChecked: false, onChange: (v) => seen.push(v) });
      inst.handlers!.onClick!({} as any);
      inst.handlers!.onClick!({} as any);
      expect(seen).toEqual([true, false]);
    });
  });

  it('Space key toggles (on keyup)', () => {
    createRoot(() => {
      const seen: boolean[] = [];
      const inst = Checkbox({ defaultChecked: false, onChange: (v) => seen.push(v) });
      inst.handlers!.onKeyUp!({ key: ' ' } as any);
      expect(seen).toEqual([true]);
    });
  });

  it('Enter key toggles', () => {
    createRoot(() => {
      const seen: boolean[] = [];
      const inst = Checkbox({ defaultChecked: false, onChange: (v) => seen.push(v) });
      inst.handlers!.onKeyDown!({ key: 'Enter' } as any);
      expect(seen).toEqual([true]);
    });
  });
});

describe('Checkbox — controlled', () => {
  it('controlled accessor: fires onChange but internal state stays fixed', () => {
    createRoot(() => {
      const [checked] = createSignal(true);
      const seen: boolean[] = [];
      const inst = Checkbox({ checked, onChange: (v) => seen.push(v) });
      inst.handlers!.onClick!({} as any);
      expect(seen).toEqual([false]); // next is !true
      expect(checked()).toBe(true);  // not changed by Checkbox
    });
  });

  it('controlled plain boolean: fires onChange correctly', () => {
    createRoot(() => {
      const seen: boolean[] = [];
      const inst = Checkbox({ checked: false, onChange: (v) => seen.push(v) });
      inst.handlers!.onClick!({} as any);
      expect(seen).toEqual([true]);
    });
  });

  it('controlled accessor set to true reflects that in onChange next value', () => {
    createRoot(() => {
      const [checked, setChecked] = createSignal(false);
      const seen: boolean[] = [];
      const inst = Checkbox({ checked, onChange: (v) => { seen.push(v); setChecked(v); } });
      inst.handlers!.onClick!({} as any);
      expect(seen).toEqual([true]);
      expect(checked()).toBe(true);
    });
  });
});

describe('Checkbox — disabled', () => {
  it('disabled blocks onClick', () => {
    createRoot(() => {
      const seen: boolean[] = [];
      const inst = Checkbox({ defaultChecked: false, disabled: true, onChange: (v) => seen.push(v) });
      inst.handlers!.onClick?.({} as any);
      expect(seen).toEqual([]);
    });
  });

  it('disabled blocks Space key', () => {
    createRoot(() => {
      const seen: boolean[] = [];
      const inst = Checkbox({ defaultChecked: false, disabled: true, onChange: (v) => seen.push(v) });
      inst.handlers!.onKeyUp!({ key: ' ' } as any);
      expect(seen).toEqual([]);
    });
  });
});

describe('Checkbox — indeterminate', () => {
  it('indeterminate prop is accepted and does not affect toggle logic', () => {
    createRoot(() => {
      const seen: boolean[] = [];
      const inst = Checkbox({ defaultChecked: false, indeterminate: true, onChange: (v) => seen.push(v) });
      inst.handlers!.onClick!({} as any);
      expect(seen).toEqual([true]);
    });
  });
});

describe('Checkbox — render-fn slot', () => {
  it('render-fn children receives ControlState + checked accessor', () => {
    createRoot(() => {
      let receivedState: any = null;
      const customChild = { layout: {} as any, children: [], handlers: {} };
      Checkbox({
        defaultChecked: true,
        children: (state) => {
          receivedState = state;
          return customChild as any;
        },
      });
      expect(receivedState).not.toBeNull();
      expect(typeof receivedState.hovered).toBe('function');
      expect(typeof receivedState.pressed).toBe('function');
      expect(typeof receivedState.focused).toBe('function');
      expect(typeof receivedState.disabled).toBe('boolean');
      expect(typeof receivedState.checked).toBe('function');
      expect(receivedState.checked()).toBe(true);
    });
  });

  it('render-fn slot: returned child is the checkbox instance child', () => {
    createRoot(() => {
      const customChild = { layout: {} as any, children: [], handlers: {} };
      const inst = Checkbox({
        children: (state) => customChild as any,
      });
      expect(inst.children).toContain(customChild);
    });
  });
});

describe('Checkbox — focusable', () => {
  it('is focusable', () => {
    createRoot(() => {
      expect(Checkbox({ defaultChecked: false }).focusable).toBe(true);
    });
  });
});

describe('Checkbox — label', () => {
  it('renders with a label without throwing', () => {
    createRoot(() => {
      expect(() => Checkbox({ label: 'Accept terms', defaultChecked: false })).not.toThrow();
    });
  });
});
