import { describe, it, expect } from 'vitest';
import { createRoot, createSignal } from '@cairn/reactivity';
import { Switch } from '../src/switch';

describe('Switch — uncontrolled', () => {
  it('click toggles internal state and fires onChange(true)', () => {
    createRoot(() => {
      const seen: boolean[] = [];
      const inst = Switch({ defaultChecked: false, onChange: (v) => seen.push(v) });
      inst.handlers!.onClick!({} as any);
      expect(seen).toEqual([true]);
    });
  });

  it('click again toggles back to false', () => {
    createRoot(() => {
      const seen: boolean[] = [];
      const inst = Switch({ defaultChecked: false, onChange: (v) => seen.push(v) });
      inst.handlers!.onClick!({} as any);
      inst.handlers!.onClick!({} as any);
      expect(seen).toEqual([true, false]);
    });
  });

  it('Space key toggles', () => {
    createRoot(() => {
      const seen: boolean[] = [];
      const inst = Switch({ defaultChecked: false, onChange: (v) => seen.push(v) });
      inst.handlers!.onKeyDown!({ key: ' ' } as any);
      expect(seen).toEqual([true]);
    });
  });

  it('Enter key toggles', () => {
    createRoot(() => {
      const seen: boolean[] = [];
      const inst = Switch({ defaultChecked: false, onChange: (v) => seen.push(v) });
      inst.handlers!.onKeyDown!({ key: 'Enter' } as any);
      expect(seen).toEqual([true]);
    });
  });
});

describe('Switch — controlled', () => {
  it('controlled accessor: fires onChange but internal state stays fixed', () => {
    createRoot(() => {
      const [on] = createSignal(true);
      const seen: boolean[] = [];
      const inst = Switch({ checked: on, onChange: (v) => seen.push(v) });
      inst.handlers!.onClick!({} as any);
      expect(seen).toEqual([false]); // next is !true
      expect(on()).toBe(true); // not changed by Switch
    });
  });

  it('controlled accessor set to false reports intent to turn on', () => {
    createRoot(() => {
      const [on, setOn] = createSignal(false);
      const seen: boolean[] = [];
      const inst = Switch({ checked: on, onChange: (v) => { seen.push(v); setOn(v); } });
      inst.handlers!.onClick!({} as any);
      expect(seen).toEqual([true]);
      expect(on()).toBe(true);
    });
  });

  it('controlled plain boolean: fires onChange correctly', () => {
    createRoot(() => {
      const seen: boolean[] = [];
      const inst = Switch({ checked: false, onChange: (v) => seen.push(v) });
      inst.handlers!.onClick!({} as any);
      expect(seen).toEqual([true]);
    });
  });
});

describe('Switch — disabled', () => {
  it('disabled blocks onClick', () => {
    createRoot(() => {
      const seen: boolean[] = [];
      const inst = Switch({ defaultChecked: false, disabled: true, onChange: (v) => seen.push(v) });
      inst.handlers!.onClick?.({} as any);
      expect(seen).toEqual([]);
    });
  });

  it('disabled blocks Space key', () => {
    createRoot(() => {
      const seen: boolean[] = [];
      const inst = Switch({ defaultChecked: false, disabled: true, onChange: (v) => seen.push(v) });
      inst.handlers!.onKeyDown!({ key: ' ' } as any);
      expect(seen).toEqual([]);
    });
  });
});

describe('Switch — thumb position', () => {
  it('thumb left reflects off/on and updates on toggle', () => {
    createRoot(() => {
      const inst = Switch({ defaultChecked: false });
      // Structure: Switch root > Stack > thumb Box
      const stack = inst.children[0];
      const thumb = stack.children[0];
      expect((thumb.layout as any).left).toBe(2);
      inst.handlers!.onClick!({} as any);
      expect((thumb.layout as any).left).toBe(22);
    });
  });
});

describe('Switch — focusable', () => {
  it('is focusable', () => {
    createRoot(() => {
      expect(Switch({ defaultChecked: false }).focusable).toBe(true);
    });
  });
});

describe('Switch — label', () => {
  it('renders with a label without throwing', () => {
    createRoot(() => {
      expect(() => Switch({ label: 'Dark mode', defaultChecked: false })).not.toThrow();
    });
  });
});
