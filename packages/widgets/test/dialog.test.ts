import { describe, it, expect, vi } from 'vitest';
import { createRoot, runWithContext, createSignal } from '@cairn/reactivity';
import { overlayContext, createOverlayRegistry, hostContext, setFrameRequester } from '@cairn/runtime';
import { themeContext } from '@cairn/style';
import { createFakeHost } from '../../primitives/test/fake-host';
import { Dialog, dialogContext } from '../src/dialog';
import { defaultTheme } from '../src/theme';

function withReg(fn: (reg: ReturnType<typeof createOverlayRegistry>) => void) {
  setFrameRequester(() => {});
  const fh = createFakeHost();
  createRoot(() => {
    const reg = createOverlayRegistry();
    try {
      runWithContext(hostContext, fh.host, () =>
        runWithContext(overlayContext, reg, () =>
          runWithContext(themeContext, () => defaultTheme, () => fn(reg)),
        ),
      );
    } finally {
      setFrameRequester(null);
    }
  });
}

// Helper: walk the instance tree to find a node matching predicate
function findInTree(inst: any, pred: (n: any) => boolean): any {
  if (!inst) return undefined;
  if (pred(inst)) return inst;
  for (const child of inst.children ?? []) {
    const found = findInTree(child, pred);
    if (found) return found;
  }
  return undefined;
}

// ─── Dialog — open/close ─────────────────────────────────────────────────────

describe('Dialog — uncontrolled open/close', () => {
  it('starts closed (no overlay)', () => {
    withReg((reg) => {
      Dialog({
        children: () => Dialog.Content({ children: Dialog.Title({ children: 'Hello' }) }),
      });
      expect(reg.list().length).toBe(0);
    });
  });

  it('Dialog.Trigger click opens the dialog (one overlay)', () => {
    withReg((reg) => {
      const inst = Dialog({
        children: () =>
          Dialog.Trigger({ children: 'Open' }),
      });
      reg.setAppRoot(inst);
      // Find the trigger element and click it
      const trigger = findInTree(inst, (n: any) => n.semantics?.onActivate != null);
      trigger?.semantics?.onActivate?.();
      expect(reg.list().length).toBe(1);
    });
  });

  it('Escape on content closes the dialog', () => {
    withReg((reg) => {
      const [open, setOpen] = createSignal(true);
      Dialog({
        open,
        onOpenChange: setOpen,
        children: () => Dialog.Content({ children: Dialog.Title({ children: 'D' }) }),
      });
      expect(reg.list().length).toBe(1);
      // Find the content semantics and dispatch Escape
      const overlay = reg.list()[0];
      const contentNode = findInTree(overlay, (n: any) => n.semantics?.role === 'dialog');
      const noMods = { shift: false, ctrl: false, alt: false, meta: false };
      contentNode?.semantics?.onKeyDown?.('Escape', noMods);
      expect(open()).toBe(false);
    });
  });

  it('backdrop click closes the dialog', () => {
    withReg((reg) => {
      let closed = false;
      const [open] = createSignal(true);
      Dialog({
        open,
        onOpenChange: (v) => { closed = !v; },
        children: () => Dialog.Content({ children: Dialog.Title({ children: 'D' }) }),
      });
      const overlay = reg.list()[0];
      // The backdrop is the full-surface catcher (first child of the stack)
      const catcher = overlay.children?.[0] ?? overlay;
      catcher.handlers?.onClick?.({ stopPropagation() {} } as any);
      expect(closed).toBe(true);
    });
  });

  it('Dialog.Close button closes the dialog', () => {
    withReg((reg) => {
      const [open, setOpen] = createSignal(true);
      Dialog({
        open,
        onOpenChange: setOpen,
        children: () =>
          Dialog.Content({
            children: Dialog.Close({ children: 'X' }),
          }),
      });
      const overlay = reg.list()[0];
      const closeBtn = findInTree(overlay, (n: any) => n.semantics?.role === 'button' && n.semantics?.label === 'X');
      closeBtn?.semantics?.onActivate?.();
      expect(open()).toBe(false);
    });
  });
});

// ─── Dialog — controlled ──────────────────────────────────────────────────────

describe('Dialog — controlled', () => {
  it('controlled open:true shows overlay', () => {
    withReg((reg) => {
      const [open] = createSignal(true);
      Dialog({
        open,
        children: () => Dialog.Content({ children: Dialog.Title({ children: 'D' }) }),
      });
      expect(reg.list().length).toBe(1);
    });
  });

  it('controlled open:false hides overlay', () => {
    withReg((reg) => {
      const [open] = createSignal(false);
      Dialog({
        open,
        children: () => Dialog.Content({ children: Dialog.Title({ children: 'D' }) }),
      });
      expect(reg.list().length).toBe(0);
    });
  });

  it('toggling controlled signal updates overlay count', () => {
    withReg((reg) => {
      const [open, setOpen] = createSignal(false);
      Dialog({
        open,
        onOpenChange: setOpen,
        children: () => Dialog.Content({ children: Dialog.Title({ children: 'D' }) }),
      });
      expect(reg.list().length).toBe(0);
      setOpen(true);
      expect(reg.list().length).toBe(1);
      setOpen(false);
      expect(reg.list().length).toBe(0);
    });
  });
});

// ─── Dialog — Content semantics ───────────────────────────────────────────────

describe('Dialog — Content semantics', () => {
  it('content has role=dialog', () => {
    withReg((reg) => {
      const [open] = createSignal(true);
      Dialog({
        open,
        children: () => Dialog.Content({ children: Dialog.Title({ children: 'My Dialog' }) }),
      });
      const overlay = reg.list()[0];
      const dialogNode = findInTree(overlay, (n: any) => n.semantics?.role === 'dialog');
      expect(dialogNode).toBeDefined();
      expect(dialogNode.semantics.role).toBe('dialog');
    });
  });

  it('content has modal:true', () => {
    withReg((reg) => {
      const [open] = createSignal(true);
      Dialog({
        open,
        children: () => Dialog.Content({ children: Dialog.Title({ children: 'My Dialog' }) }),
      });
      const overlay = reg.list()[0];
      const dialogNode = findInTree(overlay, (n: any) => n.semantics?.role === 'dialog');
      expect(dialogNode?.semantics?.modal).toBe(true);
    });
  });

  it('Dialog.Title sets the dialog label', () => {
    withReg((reg) => {
      const [open] = createSignal(true);
      Dialog({
        open,
        children: () =>
          Dialog.Content({ children: Dialog.Title({ children: 'Confirm Action' }) }),
      });
      const overlay = reg.list()[0];
      const dialogNode = findInTree(overlay, (n: any) => n.semantics?.role === 'dialog');
      expect(dialogNode?.semantics?.label).toBe('Confirm Action');
    });
  });
});

// ─── Dialog — compound context guard ─────────────────────────────────────────

describe('Dialog — context guard', () => {
  it('dialogContext.use() throws outside Dialog', () => {
    expect(() => {
      createRoot(() => {
        runWithContext(themeContext, () => defaultTheme, () => {
          dialogContext.use();
        });
      });
    }).toThrow(/Dialog/);
  });
});

// ─── Dialog — compound API ───────────────────────────────────────────────────

describe('Dialog — compound component', () => {
  it('Dialog.Trigger is defined', () => {
    expect(Dialog.Trigger).toBeDefined();
    expect(typeof Dialog.Trigger).toBe('function');
  });

  it('Dialog.Content is defined', () => {
    expect(Dialog.Content).toBeDefined();
    expect(typeof Dialog.Content).toBe('function');
  });

  it('Dialog.Title is defined', () => {
    expect(Dialog.Title).toBeDefined();
    expect(typeof Dialog.Title).toBe('function');
  });

  it('Dialog.Description is defined', () => {
    expect(Dialog.Description).toBeDefined();
    expect(typeof Dialog.Description).toBe('function');
  });

  it('Dialog.Close is defined', () => {
    expect(Dialog.Close).toBeDefined();
    expect(typeof Dialog.Close).toBe('function');
  });
});
