import { describe, it, expect } from 'vitest';
import { createRoot, createSignal } from '@cairn/reactivity';
import { Toggle } from '../src/toggle';

describe('Toggle — uncontrolled', () => {
  it('click toggles pressed from false to true and calls onChange(true)', () => {
    createRoot(() => {
      const seen: boolean[] = [];
      const inst = Toggle({ defaultPressed: false, onChange: (v) => seen.push(v) });
      inst.handlers!.onClick!({} as any);
      expect(seen).toEqual([true]);
    });
  });

  it('click toggles pressed from true to false and calls onChange(false)', () => {
    createRoot(() => {
      const seen: boolean[] = [];
      const inst = Toggle({ defaultPressed: true, onChange: (v) => seen.push(v) });
      inst.handlers!.onClick!({} as any);
      expect(seen).toEqual([false]);
    });
  });

  it('repeated clicks toggle back and forth', () => {
    createRoot(() => {
      const seen: boolean[] = [];
      const inst = Toggle({ defaultPressed: false, onChange: (v) => seen.push(v) });
      inst.handlers!.onClick!({} as any);
      inst.handlers!.onClick!({} as any);
      expect(seen).toEqual([true, false]);
    });
  });

  it('Enter key also toggles', () => {
    createRoot(() => {
      const seen: boolean[] = [];
      const inst = Toggle({ defaultPressed: false, onChange: (v) => seen.push(v) });
      inst.handlers!.onKeyDown!({ key: 'Enter' } as any);
      expect(seen).toEqual([true]);
    });
  });

  it('Space key also toggles (on keyup)', () => {
    createRoot(() => {
      const seen: boolean[] = [];
      const inst = Toggle({ defaultPressed: false, onChange: (v) => seen.push(v) });
      inst.handlers!.onKeyUp!({ key: ' ' } as any);
      expect(seen).toEqual([true]);
    });
  });
});

describe('Toggle — controlled', () => {
  it('controlled pressed:()=>true fires onChange but does not change internal state', () => {
    createRoot(() => {
      const seen: boolean[] = [];
      // controlled with pressed=true accessor — clicking should fire onChange(false)
      const [pressed] = createSignal(true);
      const inst = Toggle({ pressed, onChange: (v) => seen.push(v) });
      inst.handlers!.onClick!({} as any);
      // onChange fires with next value (opposite of current controlled value)
      expect(seen).toEqual([false]);
      // But pressed accessor still returns true — Toggle didn't change it internally
      expect(pressed()).toBe(true);
    });
  });

  it('controlled pressed:()=>false reports intent to toggle on', () => {
    createRoot(() => {
      const seen: boolean[] = [];
      const [pressed] = createSignal(false);
      const inst = Toggle({ pressed, onChange: (v) => seen.push(v) });
      inst.handlers!.onClick!({} as any);
      expect(seen).toEqual([true]);
      expect(pressed()).toBe(false); // not changed — caller must update
    });
  });

  it('controlled: supports plain boolean pressed prop', () => {
    createRoot(() => {
      const seen: boolean[] = [];
      const inst = Toggle({ pressed: true, onChange: (v) => seen.push(v) });
      inst.handlers!.onClick!({} as any);
      expect(seen).toEqual([false]);
    });
  });
});

describe('Toggle — disabled', () => {
  it('disabled blocks toggle on click', () => {
    createRoot(() => {
      const seen: boolean[] = [];
      const inst = Toggle({ defaultPressed: false, disabled: true, onChange: (v) => seen.push(v) });
      inst.handlers!.onClick?.({} as any);
      expect(seen).toEqual([]);
    });
  });

  it('disabled blocks toggle on Enter key', () => {
    createRoot(() => {
      const seen: boolean[] = [];
      const inst = Toggle({ defaultPressed: false, disabled: true, onChange: (v) => seen.push(v) });
      inst.handlers!.onKeyDown!({ key: 'Enter' } as any);
      expect(seen).toEqual([]);
    });
  });
});

describe('Toggle — render-fn slot', () => {
  it('render-fn children receives ControlState + pressed accessor', () => {
    createRoot(() => {
      let receivedState: any = null;
      const customChild = { layout: {} as any, children: [], handlers: {} };
      Toggle({
        defaultPressed: false,
        children: (state) => {
          receivedState = state;
          return customChild as any;
        },
      });
      expect(receivedState).not.toBeNull();
      expect(typeof receivedState.hovered).toBe('function');
      expect(typeof receivedState.pressed).toBe('function');   // ControlState.pressed
      expect(typeof receivedState.focused).toBe('function');
      expect(typeof receivedState.disabled).toBe('boolean');
      // pressed accessor for toggle state
      expect(typeof receivedState.togglePressed).toBe('function');
      expect(receivedState.togglePressed()).toBe(false);
    });
  });
});

describe('Toggle — focusable', () => {
  it('is focusable', () => {
    createRoot(() => {
      expect(Toggle({ defaultPressed: false }).focusable).toBe(true);
    });
  });
});
