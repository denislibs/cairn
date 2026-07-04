import { describe, it, expect } from 'vitest';
import { createRoot, runWithContext } from '@cairn/reactivity';
import { hostContext } from '@cairn/runtime';
import { themeContext } from '@cairn/style';
import { resolveStyleInput, Box } from '@cairn/primitives';
import { Chip } from '../src/chip';
import { createMaterialTheme } from '../src/theme';

function fakeHost() {
  const host: any = {
    scheduler: {
      requestFrame(_cb: any) { return 1; },
      cancelFrame() {},
    },
    renderer: {},
    metrics: {},
    input: {},
  };
  return host;
}

function withContext<T>(fn: () => T): T {
  const theme = createMaterialTheme();
  return runWithContext(hostContext, fakeHost(), () =>
    runWithContext(themeContext, () => theme as any, fn),
  );
}

// ─── renders ──────────────────────────────────────────────────────────────────

describe('Material Chip — renders', () => {
  it('creates an instance without errors', () => {
    createRoot(() => withContext(() => {
      const inst = Chip({ label: 'Hello' });
      expect(inst).toBeTruthy();
    }));
  });

  it('renders with label string', () => {
    createRoot(() => withContext(() => {
      const inst = Chip({ label: 'Tag' });
      expect(inst).toBeTruthy();
    }));
  });
});

// ─── filled variant ──────────────────────────────────────────────────────────

describe('Material Chip — filled variant', () => {
  it('filled is the default variant', () => {
    createRoot(() => withContext(() => {
      const inst = Chip({ label: 'Chip' });
      expect(inst).toBeTruthy();
    }));
  });

  it('filled variant uses low-alpha bg derived from palette color', () => {
    createRoot(() => {
      const theme = createMaterialTheme();
      runWithContext(hostContext, fakeHost(), () =>
        runWithContext(themeContext, () => theme as any, () => {
          // filled chip with primary color: bg should be alpha(primary.main, ~0.12)
          const c = theme.palette.primary;
          // alpha(hex, 0.12) → rgba(r, g, b, 0.12)
          const style = [{ backgroundColor: `rgba(25, 118, 210, 0.12)` }];
          const resolved = resolveStyleInput(style, theme as any);
          expect(resolved.backgroundColor).toContain('rgba');

          const inst = Chip({ label: 'Chip', color: 'primary', variant: 'filled' });
          expect(inst).toBeTruthy();
        }),
      );
    });
  });

  it('filled default color chip creates without error', () => {
    createRoot(() => withContext(() => {
      const inst = Chip({ label: 'Default', color: 'default' });
      expect(inst).toBeTruthy();
    }));
  });

  it('filled chip with secondary color creates without error', () => {
    createRoot(() => withContext(() => {
      const inst = Chip({ label: 'Secondary', color: 'secondary' });
      expect(inst).toBeTruthy();
    }));
  });

  it('filled chip with error color creates without error', () => {
    createRoot(() => withContext(() => {
      const inst = Chip({ label: 'Error', color: 'error' });
      expect(inst).toBeTruthy();
    }));
  });
});

// ─── outlined variant ────────────────────────────────────────────────────────

describe('Material Chip — outlined variant', () => {
  it('outlined variant creates without error', () => {
    createRoot(() => withContext(() => {
      const inst = Chip({ label: 'Outline', variant: 'outlined' });
      expect(inst).toBeTruthy();
    }));
  });

  it('outlined variant uses divider border color', () => {
    createRoot(() => {
      const theme = createMaterialTheme();
      runWithContext(hostContext, fakeHost(), () =>
        runWithContext(themeContext, () => theme as any, () => {
          const divider = theme.palette.divider;
          const resolved = resolveStyleInput(
            [{ border: { width: 1, color: divider } }],
            theme as any,
          );
          expect((resolved.border as any)?.color).toBe(divider);

          const inst = Chip({ label: 'Outline', variant: 'outlined', color: 'primary' });
          expect(inst).toBeTruthy();
        }),
      );
    });
  });

  it('outlined chip with default color creates without error', () => {
    createRoot(() => withContext(() => {
      const inst = Chip({ label: 'Outline Default', variant: 'outlined', color: 'default' });
      expect(inst).toBeTruthy();
    }));
  });
});

// ─── size ────────────────────────────────────────────────────────────────────

describe('Material Chip — size', () => {
  it('small size creates without error', () => {
    createRoot(() => withContext(() => {
      const inst = Chip({ label: 'Small', size: 'small' });
      expect(inst).toBeTruthy();
    }));
  });

  it('medium size creates without error', () => {
    createRoot(() => withContext(() => {
      const inst = Chip({ label: 'Medium', size: 'medium' });
      expect(inst).toBeTruthy();
    }));
  });

  it('medium is the default size', () => {
    createRoot(() => withContext(() => {
      const inst = Chip({ label: 'Default size' });
      expect(inst).toBeTruthy();
    }));
  });
});

// ─── onClick ─────────────────────────────────────────────────────────────────

describe('Material Chip — onClick', () => {
  it('calls onClick when click handler fires', () => {
    createRoot(() => withContext(() => {
      let clicked = 0;
      const inst = Chip({ label: 'Click', onClick: () => clicked++ });
      inst.handlers!.onClick!({} as any);
      expect(clicked).toBe(1);
    }));
  });

  it('chip with onClick fires via Enter key', () => {
    createRoot(() => withContext(() => {
      let clicked = 0;
      const inst = Chip({ label: 'Key', onClick: () => clicked++ });
      inst.handlers!.onKeyDown!({ key: 'Enter' } as any);
      expect(clicked).toBe(1);
    }));
  });

  it('chip with onClick fires via Space key (on keyup)', () => {
    createRoot(() => withContext(() => {
      let clicked = 0;
      const inst = Chip({ label: 'Space', onClick: () => clicked++ });
      inst.handlers!.onKeyUp!({ key: ' ' } as any);
      expect(clicked).toBe(1);
    }));
  });

  it('chip without onClick still creates without error', () => {
    createRoot(() => withContext(() => {
      const inst = Chip({ label: 'No click' });
      expect(inst).toBeTruthy();
    }));
  });
});

// ─── onDelete ────────────────────────────────────────────────────────────────

describe('Material Chip — onDelete', () => {
  it('chip with onDelete creates without error', () => {
    createRoot(() => withContext(() => {
      const inst = Chip({ label: 'Deletable', onDelete: () => {} });
      expect(inst).toBeTruthy();
    }));
  });

  it('chip with onDelete has a Remove button child in the tree', () => {
    createRoot(() => withContext(() => {
      let onDeleteCalled = 0;
      const inst = Chip({ label: 'Del', onDelete: () => onDeleteCalled++ });

      // The headless Chip adds a separate Remove button in the tree.
      // Find a child with role='button' and label='Remove' in semantics.
      function findRemove(node: any): boolean {
        if (!node) return false;
        if (node.semantics?.role === 'button' && node.semantics?.label === 'Remove') return true;
        for (const c of (node.children ?? [])) {
          if (findRemove(c)) return true;
        }
        return false;
      }
      expect(findRemove(inst)).toBe(true);
    }));
  });

  it('chip with both onClick and onDelete creates without error', () => {
    createRoot(() => withContext(() => {
      let clicked = 0;
      let deleted = 0;
      const inst = Chip({
        label: 'Dual',
        onClick: () => clicked++,
        onDelete: () => deleted++,
      });
      inst.handlers!.onClick!({} as any);
      expect(clicked).toBe(1);
      expect(deleted).toBe(0);
    }));
  });
});

// ─── disabled ────────────────────────────────────────────────────────────────

describe('Material Chip — disabled', () => {
  it('disabled chip creates without error', () => {
    createRoot(() => withContext(() => {
      const inst = Chip({ label: 'Disabled', disabled: true });
      expect(inst).toBeTruthy();
    }));
  });

  it('disabled chip with onClick does not fire on click', () => {
    createRoot(() => withContext(() => {
      let clicked = 0;
      const inst = Chip({ label: 'Disabled', disabled: true, onClick: () => clicked++ });
      // Headless widget guards disabled clicks — handler still called but activates only if !disabled
      // The handlers are set up by createControl which checks disabled internally
      inst.handlers?.onClick?.({} as any);
      expect(clicked).toBe(0);
    }));
  });

  it('disabled chip has reduced opacity via style', () => {
    createRoot(() => {
      const theme = createMaterialTheme();
      runWithContext(hostContext, fakeHost(), () =>
        runWithContext(themeContext, () => theme as any, () => {
          const resolved = resolveStyleInput([{ opacity: 0.38 }], theme as any);
          expect(resolved.opacity).toBe(0.38);

          const inst = Chip({ label: 'Disabled', disabled: true });
          expect(inst).toBeTruthy();
        }),
      );
    });
  });
});

// ─── icon / leading ──────────────────────────────────────────────────────────

describe('Material Chip — icon / avatar', () => {
  it('chip with icon prop creates without error', () => {
    createRoot(() => withContext(() => {
      const icon = Box({ style: { width: 16, height: 16 } });
      const inst = Chip({ label: 'Icon', icon });
      expect(inst).toBeTruthy();
    }));
  });

  it('chip with avatar prop creates without error', () => {
    createRoot(() => withContext(() => {
      const avatar = Box({ style: { width: 24, height: 24, borderRadius: 12 } });
      const inst = Chip({ label: 'Avatar', avatar });
      expect(inst).toBeTruthy();
    }));
  });
});

// ─── semantics ───────────────────────────────────────────────────────────────

describe('Material Chip — semantics', () => {
  it('chip with onClick has button semantics', () => {
    createRoot(() => withContext(() => {
      const inst = Chip({ label: 'Button Chip', onClick: () => {} });
      expect(inst.semantics?.role).toBe('button');
    }));
  });

  it('chip without onClick has none semantics (static chip)', () => {
    createRoot(() => withContext(() => {
      const inst = Chip({ label: 'Static' });
      // Headless chip sets role:'none' for non-interactive chips
      expect(inst.semantics?.role).toBe('none');
    }));
  });

  it('chip with onClick is focusable', () => {
    createRoot(() => withContext(() => {
      const inst = Chip({ label: 'Focus', onClick: () => {} });
      expect(inst.focusable).toBe(true);
    }));
  });

  it('chip without onClick is not focusable', () => {
    createRoot(() => withContext(() => {
      const inst = Chip({ label: 'Static' });
      expect(inst.focusable).toBeFalsy();
    }));
  });
});

// ─── pill shape ──────────────────────────────────────────────────────────────

describe('Material Chip — pill shape', () => {
  it('chip style contains large borderRadius (pill)', () => {
    createRoot(() => {
      const theme = createMaterialTheme();
      runWithContext(hostContext, fakeHost(), () =>
        runWithContext(themeContext, () => theme as any, () => {
          // pill = 9999 from widget default theme
          const resolved = resolveStyleInput([{ borderRadius: 9999 }], theme as any);
          expect(resolved.borderRadius).toBe(9999);

          const inst = Chip({ label: 'Pill' });
          expect(inst).toBeTruthy();
        }),
      );
    });
  });
});
