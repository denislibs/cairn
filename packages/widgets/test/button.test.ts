import { describe, it, expect } from 'vitest';
import { createRoot } from '@cairn/reactivity';
import { Button } from '../src/button';

it('calls onClick when clicked', () => {
  createRoot(() => {
    let clicked = 0;
    const inst = Button({ label: 'OK', onClick: () => clicked++ });
    inst.handlers!.onClick!({} as any);
    expect(clicked).toBe(1);
  });
});
it('disabled blocks onClick', () => {
  createRoot(() => {
    let clicked = 0;
    const inst = Button({ label: 'OK', disabled: true, onClick: () => clicked++ });
    inst.handlers!.onClick?.({} as any);
    expect(clicked).toBe(0);
  });
});
it('Enter key triggers onClick', () => {
  createRoot(() => {
    let clicked = 0;
    const inst = Button({ label: 'OK', onClick: () => clicked++ });
    inst.handlers!.onKeyDown!({ key: 'Enter' } as any);
    expect(clicked).toBe(1);
  });
});
it('Space key triggers onClick', () => {
  createRoot(() => {
    let clicked = 0;
    const inst = Button({ label: 'OK', onClick: () => clicked++ });
    inst.handlers!.onKeyDown!({ key: ' ' } as any);
    expect(clicked).toBe(1);
  });
});
it('is focusable', () => {
  createRoot(() => {
    expect(Button({ label: 'OK', onClick() {} }).focusable).toBe(true);
  });
});
