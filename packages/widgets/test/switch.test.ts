import { describe, it, expect } from 'vitest';
import { createRoot, createSignal } from '@cairn/reactivity';
import { Switch } from '../src/switch';

it('uncontrolled toggles on click', () => {
  createRoot(() => {
    const seen: boolean[] = [];
    const inst = Switch({ defaultValue: false, onChange: (v) => seen.push(v) });
    inst.handlers!.onClick!({} as any);
    expect(seen).toEqual([true]);
  });
});
it('controlled reflects provided value and reports intent', () => {
  createRoot(() => {
    const [on, setOn] = createSignal(false);
    const seen: boolean[] = [];
    const inst = Switch({ value: on, onChange: (v) => { seen.push(v); setOn(v); } });
    inst.handlers!.onClick!({} as any);
    expect(seen).toEqual([true]);
    expect(on()).toBe(true);
  });
});
it('disabled does not toggle', () => {
  createRoot(() => {
    const seen: boolean[] = [];
    const inst = Switch({ defaultValue: false, disabled: true, onChange: (v) => seen.push(v) });
    inst.handlers!.onClick?.({} as any);
    expect(seen).toEqual([]);
  });
});
it('Space toggles', () => {
  createRoot(() => {
    const seen: boolean[] = [];
    const inst = Switch({ defaultValue: false, onChange: (v) => seen.push(v) });
    inst.handlers!.onKeyDown!({ key: ' ' } as any);
    expect(seen).toEqual([true]);
  });
});
