import { describe, it, expect } from 'vitest';
import { createRoot } from '@cairn/reactivity';
import { Slider } from '../src/slider';

it('pointer sets value from localX', () => {
  createRoot(() => {
    let v = 0;
    const inst = Slider({ value: () => v, min: 0, max: 100, width: 100, onChange: (n) => (v = n) });
    inst.handlers!.onPointerDown!({ localX: 50 } as any);
    expect(v).toBe(50);
  });
});
it('ArrowRight increments by step', () => {
  createRoot(() => {
    let v = 10;
    const inst = Slider({ value: () => v, min: 0, max: 100, step: 5, width: 100, onChange: (n) => (v = n) });
    inst.handlers!.onKeyDown!({ key: 'ArrowRight' } as any);
    expect(v).toBe(15);
  });
});
it('ArrowLeft decrements and clamps at min', () => {
  createRoot(() => {
    let v = 2;
    const inst = Slider({ value: () => v, min: 0, max: 100, step: 5, width: 100, onChange: (n) => (v = n) });
    inst.handlers!.onKeyDown!({ key: 'ArrowLeft' } as any);
    expect(v).toBe(0);
  });
});
it('disabled ignores pointer', () => {
  createRoot(() => {
    let v = 0;
    const inst = Slider({ value: () => v, min: 0, max: 100, width: 100, disabled: true, onChange: (n) => (v = n) });
    inst.handlers!.onPointerDown?.({ localX: 50 } as any);
    expect(v).toBe(0);
  });
});
it('is focusable', () => {
  createRoot(() => {
    expect(Slider({ value: () => 0, min: 0, max: 100, width: 100, onChange() {} }).focusable).toBe(true);
  });
});
