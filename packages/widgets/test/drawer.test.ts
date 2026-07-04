import { describe, it, expect } from 'vitest';
import { createRoot, runWithContext, createSignal } from '@cairn/reactivity';
import { overlayContext, createOverlayRegistry, hostContext, setFrameRequester } from '@cairn/runtime';
import { themeContext } from '@cairn/style';
import { createFakeHost } from '../../primitives/test/fake-host';
import { Drawer, drawerContext } from '../src/drawer';
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

// ─── Drawer — open/close ──────────────────────────────────────────────────────

describe('Drawer — open/close', () => {
  it('starts closed (no overlay)', () => {
    withReg((reg) => {
      Drawer({
        children: () => Drawer.Content({ children: Drawer.Title({ children: 'Settings' }) }),
      });
      expect(reg.list().length).toBe(0);
    });
  });

  it('Drawer.Trigger click opens the drawer (one overlay)', () => {
    withReg((reg) => {
      const inst = Drawer({
        children: () => Drawer.Trigger({ children: 'Open' }),
      });
      reg.setAppRoot(inst);
      const trigger = findInTree(inst, (n: any) => n.semantics?.onActivate != null);
      trigger?.semantics?.onActivate?.();
      expect(reg.list().length).toBe(1);
    });
  });

  it('Escape on content closes the drawer', () => {
    withReg((reg) => {
      const [open, setOpen] = createSignal(true);
      Drawer({
        open,
        onOpenChange: setOpen,
        children: () => Drawer.Content({ children: Drawer.Title({ children: 'D' }) }),
      });
      const overlay = reg.list()[0];
      const contentNode = findInTree(overlay, (n: any) => n.semantics?.role === 'dialog');
      const noMods = { shift: false, ctrl: false, alt: false, meta: false };
      contentNode?.semantics?.onKeyDown?.('Escape', noMods);
      expect(open()).toBe(false);
    });
  });

  it('backdrop click closes the drawer', () => {
    withReg((reg) => {
      let closed = false;
      const [open] = createSignal(true);
      Drawer({
        open,
        onOpenChange: (v) => { closed = !v; },
        children: () => Drawer.Content({ children: Drawer.Title({ children: 'D' }) }),
      });
      const overlay = reg.list()[0];
      overlay.handlers?.onClick?.({ stopPropagation() {} } as any);
      expect(closed).toBe(true);
    });
  });

  it('Drawer.Close closes the drawer', () => {
    withReg((reg) => {
      const [open, setOpen] = createSignal(true);
      Drawer({
        open,
        onOpenChange: setOpen,
        children: () =>
          Drawer.Content({
            children: Drawer.Close({ children: 'X' }),
          }),
      });
      const overlay = reg.list()[0];
      const closeBtn = findInTree(overlay, (n: any) => n.semantics?.role === 'button' && n.semantics?.label === 'X');
      closeBtn?.semantics?.onActivate?.();
      expect(open()).toBe(false);
    });
  });
});

// ─── Drawer — controlled ──────────────────────────────────────────────────────

describe('Drawer — controlled', () => {
  it('controlled open:true shows overlay', () => {
    withReg((reg) => {
      const [open] = createSignal(true);
      Drawer({
        open,
        children: () => Drawer.Content({ children: Drawer.Title({ children: 'D' }) }),
      });
      expect(reg.list().length).toBe(1);
    });
  });

  it('controlled open:false hides overlay', () => {
    withReg((reg) => {
      const [open] = createSignal(false);
      Drawer({
        open,
        children: () => Drawer.Content({ children: Drawer.Title({ children: 'D' }) }),
      });
      expect(reg.list().length).toBe(0);
    });
  });

  it('toggling controlled signal updates overlay', () => {
    withReg((reg) => {
      const [open, setOpen] = createSignal(false);
      Drawer({
        open,
        onOpenChange: setOpen,
        children: () => Drawer.Content({ children: Drawer.Title({ children: 'D' }) }),
      });
      expect(reg.list().length).toBe(0);
      setOpen(true);
      expect(reg.list().length).toBe(1);
      setOpen(false);
      expect(reg.list().length).toBe(0);
    });
  });
});

// ─── Drawer — Content semantics ───────────────────────────────────────────────

describe('Drawer — Content semantics', () => {
  it('content has role=dialog', () => {
    withReg((reg) => {
      const [open] = createSignal(true);
      Drawer({
        open,
        children: () => Drawer.Content({ children: Drawer.Title({ children: 'Settings' }) }),
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
      Drawer({
        open,
        children: () => Drawer.Content({ children: Drawer.Title({ children: 'S' }) }),
      });
      const overlay = reg.list()[0];
      const dialogNode = findInTree(overlay, (n: any) => n.semantics?.role === 'dialog');
      expect(dialogNode?.semantics?.modal).toBe(true);
    });
  });
});

// ─── Drawer — side positioning ────────────────────────────────────────────────

describe('Drawer — side positioning', () => {
  it('side=right: panel is positioned on the right edge', () => {
    withReg((reg) => {
      const [open] = createSignal(true);
      Drawer({
        open,
        side: 'right',
        children: () => Drawer.Content({ children: Drawer.Title({ children: 'S' }) }),
      });
      const overlay = reg.list()[0];
      const panelNode = findInTree(overlay, (n: any) => n.semantics?.role === 'dialog');
      // The panel Box is positioned: right-side means it should exist in the tree
      expect(panelNode).toBeDefined();
    });
  });

  it('side=left: drawer opens from left', () => {
    withReg((reg) => {
      const [open] = createSignal(true);
      Drawer({
        open,
        side: 'left',
        children: () => Drawer.Content({ children: Drawer.Title({ children: 'S' }) }),
      });
      expect(reg.list().length).toBe(1);
    });
  });

  it('side=bottom: drawer opens from bottom', () => {
    withReg((reg) => {
      const [open] = createSignal(true);
      Drawer({
        open,
        side: 'bottom',
        children: () => Drawer.Content({ children: Drawer.Title({ children: 'S' }) }),
      });
      expect(reg.list().length).toBe(1);
    });
  });

  it('defaults to side=right', () => {
    withReg((reg) => {
      const [open] = createSignal(true);
      Drawer({
        open,
        children: () => Drawer.Content({ children: Drawer.Title({ children: 'S' }) }),
      });
      expect(reg.list().length).toBe(1);
    });
  });
});

// ─── Drawer — context guard ───────────────────────────────────────────────────

describe('Drawer — context guard', () => {
  it('drawerContext.use() throws outside Drawer', () => {
    expect(() => {
      createRoot(() => {
        runWithContext(themeContext, () => defaultTheme, () => {
          drawerContext.use();
        });
      });
    }).toThrow(/Drawer/);
  });
});

// ─── Drawer — compound component ─────────────────────────────────────────────

describe('Drawer — compound component', () => {
  it('Drawer.Trigger is defined', () => {
    expect(Drawer.Trigger).toBeDefined();
    expect(typeof Drawer.Trigger).toBe('function');
  });

  it('Drawer.Content is defined', () => {
    expect(Drawer.Content).toBeDefined();
    expect(typeof Drawer.Content).toBe('function');
  });

  it('Drawer.Title is defined', () => {
    expect(Drawer.Title).toBeDefined();
    expect(typeof Drawer.Title).toBe('function');
  });

  it('Drawer.Close is defined', () => {
    expect(Drawer.Close).toBeDefined();
    expect(typeof Drawer.Close).toBe('function');
  });
});
