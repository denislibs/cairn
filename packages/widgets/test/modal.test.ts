import { describe, it, expect } from 'vitest';
import { createRoot, runWithContext, createSignal } from '@cairn/reactivity';
import { overlayContext, createOverlayRegistry } from '@cairn/runtime';
import { Modal } from '../src/modal';
import { Box } from '@cairn/primitives';

function withReg(fn: (reg: ReturnType<typeof createOverlayRegistry>) => void) {
  createRoot(() => {
    const reg = createOverlayRegistry();
    runWithContext(overlayContext, reg, () => fn(reg));
  });
}

it('closed → no overlay; open → one overlay', () => {
  withReg((reg) => {
    const [open, setOpen] = createSignal(false);
    Modal({ open, onClose: () => {}, children: Box({ style: { width: 200, height: 120 } }) });
    expect(reg.list().length).toBe(0);
    setOpen(true);
    expect(reg.list().length).toBe(1);
    setOpen(false);
    expect(reg.list().length).toBe(0);
  });
});

it('backdrop click calls onClose', () => {
  withReg((reg) => {
    let closed = 0;
    const [open] = createSignal(true);
    Modal({ open, onClose: () => closed++, children: Box({ style: { width: 200, height: 120 } }) });
    // the overlay is the backdrop Box; invoke its onClick
    const backdrop = reg.list()[0];
    backdrop.handlers!.onClick!({ stopPropagation() {} } as any);
    expect(closed).toBe(1);
  });
});

it('Escape calls onClose', () => {
  withReg((reg) => {
    let closed = 0;
    const [open] = createSignal(true);
    Modal({ open, onClose: () => closed++, children: Box({ style: { width: 200, height: 120 } }) });
    const backdrop = reg.list()[0];
    backdrop.handlers!.onKeyDown!({ key: 'Escape' } as any);
    expect(closed).toBe(1);
  });
});
