import { describe, it, expect } from 'vitest';
import { createRoot, createSignal } from '@cairn/reactivity';
import { Checkbox } from '../src/checkbox';

it('uncontrolled toggles internal state on click', () => {
  createRoot(() => {
    const seen: boolean[] = [];
    const inst = Checkbox({ defaultChecked: false, onChange: (v) => seen.push(v) });
    inst.handlers!.onClick!({} as any);
    expect(seen).toEqual([true]);
  });
});
it('controlled reflects the provided value and reports intent', () => {
  createRoot(() => {
    const [checked, setChecked] = createSignal(false);
    const seen: boolean[] = [];
    const inst = Checkbox({ checked, onChange: (v) => { seen.push(v); setChecked(v); } });
    inst.handlers!.onClick!({} as any);
    expect(seen).toEqual([true]);
    expect(checked()).toBe(true);
  });
});
it('disabled does not toggle', () => {
  createRoot(() => {
    const seen: boolean[] = [];
    const inst = Checkbox({ defaultChecked: false, disabled: true, onChange: (v) => seen.push(v) });
    inst.handlers!.onClick?.({} as any);
    expect(seen).toEqual([]);
  });
});
it('Space toggles', () => {
  createRoot(() => {
    const seen: boolean[] = [];
    const inst = Checkbox({ defaultChecked: false, onChange: (v) => seen.push(v) });
    inst.handlers!.onKeyDown!({ key: ' ' } as any);
    expect(seen).toEqual([true]);
  });
});
