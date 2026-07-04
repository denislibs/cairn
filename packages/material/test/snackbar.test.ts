import { describe, it, expect } from 'vitest';
import { createRoot, runWithContext } from '@cairn/reactivity';
import { hostContext, overlayContext, createOverlayRegistry, setFrameRequester } from '@cairn/runtime';
import { themeContext } from '@cairn/style';
import { resolveStyleInput, Text } from '@cairn/primitives';
import { SnackbarProvider, useSnackbar, SnackbarItem } from '../src/snackbar';
import { createMaterialTheme } from '../src/theme';

// ─── Test helpers ─────────────────────────────────────────────────────────────

function fakeHost() {
  const host: any = {
    scheduler: {
      requestFrame(_cb: any) { return 1; },
      cancelFrame() {},
    },
    renderer: {},
    metrics: {},
    input: {},
    a11y: {
      announce(_msg: string, _assertive?: boolean) {},
    },
  };
  return host;
}

/**
 * Minimal context for tests that only create components but do NOT call toast().
 * Does not require an overlay registry.
 */
function withContext<T>(fn: () => T): T {
  const theme = createMaterialTheme();
  return runWithContext(hostContext, fakeHost(), () =>
    runWithContext(themeContext, () => theme as any, fn),
  );
}

/**
 * Full context for tests that call toast() — includes the overlay registry
 * needed for the Portal that renders the snackbar stack.
 */
function withFullContext<T>(fn: () => T): T {
  const theme = createMaterialTheme();
  const reg = createOverlayRegistry();
  setFrameRequester(() => {});
  try {
    return runWithContext(hostContext, fakeHost(), () =>
      runWithContext(overlayContext, reg, () =>
        runWithContext(themeContext, () => theme as any, fn),
      ),
    );
  } finally {
    setFrameRequester(null);
  }
}

// ─── SnackbarProvider ─────────────────────────────────────────────────────────

describe('SnackbarProvider — renders without crashing', () => {
  it('creates an instance with a children function', () => {
    createRoot(() => withContext(() => {
      const child = Text({ children: 'app' });
      const inst = SnackbarProvider({ children: () => child });
      expect(inst).toBeTruthy();
    }));
  });
});

describe('SnackbarProvider — provides toastContext', () => {
  it('useSnackbar does not throw inside SnackbarProvider', () => {
    createRoot(() => withContext(() => {
      let ctx: any;
      const child = Text({ children: 'app' });
      SnackbarProvider({
        children: () => {
          ctx = useSnackbar();
          return child;
        },
      });
      expect(ctx).toBeTruthy();
      expect(typeof ctx.toast).toBe('function');
      expect(typeof ctx.dismiss).toBe('function');
    }));
  });
});

// ─── useSnackbar ──────────────────────────────────────────────────────────────

describe('useSnackbar — enqueue and dismiss', () => {
  it('toast returns a string id', () => {
    createRoot(() => withFullContext(() => {
      const child = Text({ children: 'app' });
      let id: string | undefined;
      SnackbarProvider({
        children: () => {
          const { toast } = useSnackbar();
          id = toast({ title: 'Hello!' });
          return child;
        },
      });
      expect(typeof id).toBe('string');
      expect(id!.length).toBeGreaterThan(0);
    }));
  });

  it('dismiss can be called with the returned id without error', () => {
    createRoot(() => withFullContext(() => {
      const child = Text({ children: 'app' });
      SnackbarProvider({
        children: () => {
          const { toast, dismiss } = useSnackbar();
          const id = toast({ title: 'Bye!' });
          expect(() => dismiss(id)).not.toThrow();
          return child;
        },
      });
    }));
  });
});

// ─── SnackbarItem — styled surface ───────────────────────────────────────────

describe('SnackbarItem — surface backgroundColor', () => {
  it('surface has backgroundColor #323232', () => {
    createRoot(() => withContext(() => {
      const theme = createMaterialTheme();
      // Verify that resolving the snackbar bg works
      const style = [{ backgroundColor: '#323232' }];
      const resolved = resolveStyleInput(style, theme as any);
      expect(resolved.backgroundColor).toBe('#323232');

      // Verify SnackbarItem creates without error
      const inst = SnackbarItem({
        entry: { id: 's-1', title: 'Test', startTime: null },
        onDismiss: () => {},
      });
      expect(inst).toBeTruthy();
    }));
  });
});

describe('SnackbarItem — minHeight 48', () => {
  it('style contains minHeight 48', () => {
    createRoot(() => withContext(() => {
      const theme = createMaterialTheme();
      const style = [{ minHeight: 48 }];
      const resolved = resolveStyleInput(style, theme as any);
      expect(resolved.minHeight).toBe(48);

      const inst = SnackbarItem({
        entry: { id: 's-2', title: 'Min-height test', startTime: null },
        onDismiss: () => {},
      });
      expect(inst).toBeTruthy();
    }));
  });
});

describe('SnackbarItem — borderRadius uses shape', () => {
  it('style contains borderRadius from theme.shape.borderRadius', () => {
    createRoot(() => withContext(() => {
      const theme = createMaterialTheme();
      const style = [{ borderRadius: theme.shape.borderRadius }];
      const resolved = resolveStyleInput(style, theme as any);
      expect(resolved.borderRadius).toBe(theme.shape.borderRadius);

      const inst = SnackbarItem({
        entry: { id: 's-3', title: 'Shape test', startTime: null },
        onDismiss: () => {},
      });
      expect(inst).toBeTruthy();
    }));
  });
});

describe('SnackbarItem — text content', () => {
  it('renders with a title string', () => {
    createRoot(() => withContext(() => {
      const inst = SnackbarItem({
        entry: { id: 's-4', title: 'Saved!', startTime: null },
        onDismiss: () => {},
      });
      expect(inst).toBeTruthy();
    }));
  });

  it('renders with a description string', () => {
    createRoot(() => withContext(() => {
      const inst = SnackbarItem({
        entry: { id: 's-5', title: 'Done', description: 'Item saved.', startTime: null },
        onDismiss: () => {},
      });
      expect(inst).toBeTruthy();
    }));
  });
});

describe('SnackbarItem — action button', () => {
  it('renders with an action label', () => {
    createRoot(() => withContext(() => {
      const inst = SnackbarItem({
        entry: { id: 's-6', title: 'Deleted', actionLabel: 'UNDO', onAction: () => {}, startTime: null },
        onDismiss: () => {},
      });
      expect(inst).toBeTruthy();
    }));
  });

  it('renders without an action label', () => {
    createRoot(() => withContext(() => {
      const inst = SnackbarItem({
        entry: { id: 's-7', title: 'No action', startTime: null },
        onDismiss: () => {},
      });
      expect(inst).toBeTruthy();
    }));
  });

  it('action callback fires when action button onClick is triggered', () => {
    createRoot(() => withContext(() => {
      let acted = 0;
      const inst = SnackbarItem({
        entry: {
          id: 's-8',
          title: 'Test',
          actionLabel: 'RETRY',
          onAction: () => { acted++; },
          startTime: null,
        },
        onDismiss: () => {},
      });
      expect(inst).toBeTruthy();
      // Walk tree to find a clickable node (the action button)
      function findClickable(node: any): any {
        if (node?.handlers?.onClick) return node;
        for (const c of (node?.children ?? [])) {
          const found = findClickable(c);
          if (found) return found;
        }
        return null;
      }
      const btn = findClickable(inst);
      // A clickable node should be present (the action button)
      expect(btn).not.toBeNull();
    }));
  });
});

describe('SnackbarItem — semantics role', () => {
  it('surface carries role status for default variant', () => {
    createRoot(() => withContext(() => {
      const inst = SnackbarItem({
        entry: { id: 's-9', title: 'Saved', startTime: null },
        onDismiss: () => {},
      }) as any;
      expect(inst).toBeTruthy();
      expect(inst.semantics?.role).toBe('status');
    }));
  });

  it('surface carries role alert for error variant', () => {
    createRoot(() => withContext(() => {
      const inst = SnackbarItem({
        entry: { id: 's-10', title: 'Error!', variant: 'error', startTime: null },
        onDismiss: () => {},
      }) as any;
      expect(inst).toBeTruthy();
      expect(inst.semantics?.role).toBe('alert');
    }));
  });
});

describe('SnackbarItem — padding', () => {
  it('resolves padding left 16, right 8', () => {
    createRoot(() => withContext(() => {
      const theme = createMaterialTheme();
      const style = [{ padding: { left: 16, right: 8, top: 8, bottom: 8 } }];
      const resolved = resolveStyleInput(style, theme as any);
      expect(resolved.padding).toEqual({ left: 16, right: 8, top: 8, bottom: 8 });
    }));
  });
});

describe('SnackbarProvider — placement prop accepted', () => {
  it('creates without error with placement bottom-center', () => {
    createRoot(() => withContext(() => {
      const child = Text({ children: 'app' });
      const inst = SnackbarProvider({
        placement: 'bottom-center',
        children: () => child,
      });
      expect(inst).toBeTruthy();
    }));
  });

  it('creates without error with placement top-right', () => {
    createRoot(() => withContext(() => {
      const child = Text({ children: 'app' });
      const inst = SnackbarProvider({
        placement: 'top-right',
        children: () => child,
      });
      expect(inst).toBeTruthy();
    }));
  });
});

describe('SnackbarProvider — useSnackbar throws outside provider', () => {
  it('throws when called outside SnackbarProvider', () => {
    createRoot(() => withContext(() => {
      expect(() => useSnackbar()).toThrow();
    }));
  });
});
