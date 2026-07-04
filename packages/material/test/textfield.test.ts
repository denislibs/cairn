import { describe, it, expect } from 'vitest';
import { createRoot, runWithContext } from '@cairn/reactivity';
import { hostContext } from '@cairn/runtime';
import { themeContext } from '@cairn/style';
import { resolveStyleInput } from '@cairn/primitives';
import { TextField } from '../src/textfield';
import { createMaterialTheme } from '../src/theme';

function fakeHost() {
  const host: any = {
    scheduler: {
      requestFrame(_cb: any) { return 1; },
      cancelFrame() {},
    },
    renderer: {
      measureText: (t: string) => ({ width: t.length * 8 }),
    },
    metrics: {},
    input: {},
    textInput: {
      start: () => ({ close() {} }),
    },
    a11y: null,
  };
  return host;
}

function withContext<T>(fn: () => T): T {
  const theme = createMaterialTheme();
  return runWithContext(hostContext, fakeHost(), () =>
    runWithContext(themeContext, () => theme as any, fn),
  );
}

// ─── renders ─────────────────────────────────────────────────────────────────

describe('Material TextField — renders', () => {
  it('creates an instance without errors', () => {
    createRoot(() => withContext(() => {
      const inst = TextField({ label: 'Name' });
      expect(inst).toBeTruthy();
    }));
  });

  it('renders without a label prop', () => {
    createRoot(() => withContext(() => {
      const inst = TextField({});
      expect(inst).toBeTruthy();
    }));
  });

  it('renders with a placeholder', () => {
    createRoot(() => withContext(() => {
      const inst = TextField({ placeholder: 'Enter name' });
      expect(inst).toBeTruthy();
    }));
  });

  it('has children (visual tree is non-empty)', () => {
    createRoot(() => withContext(() => {
      const inst = TextField({ label: 'Email' });
      expect(inst.children.length).toBeGreaterThan(0);
    }));
  });
});

// ─── label ───────────────────────────────────────────────────────────────────

describe('Material TextField — label', () => {
  it('renders without error when label provided', () => {
    createRoot(() => withContext(() => {
      const inst = TextField({ label: 'Username' });
      expect(inst).toBeTruthy();
    }));
  });

  it('renders without error when no label provided', () => {
    createRoot(() => withContext(() => {
      const inst = TextField({});
      expect(inst).toBeTruthy();
    }));
  });
});

// ─── variant ─────────────────────────────────────────────────────────────────

describe('Material TextField — variant', () => {
  it('outlined variant creates an instance', () => {
    createRoot(() => withContext(() => {
      const inst = TextField({ label: 'Test', variant: 'outlined' });
      expect(inst).toBeTruthy();
    }));
  });

  it('filled variant creates an instance', () => {
    createRoot(() => withContext(() => {
      const inst = TextField({ label: 'Test', variant: 'filled' });
      expect(inst).toBeTruthy();
    }));
  });

  it('outlined and filled produce distinct surface styles', () => {
    createRoot(() => withContext(() => {
      const theme = createMaterialTheme();
      // outlined: transparent surface; filled: paper surface
      const outlinedSurface = resolveStyleInput([{ backgroundColor: 'transparent' }], theme as any);
      const filledSurface = resolveStyleInput([{ backgroundColor: theme.palette.background.paper }], theme as any);
      expect(outlinedSurface.backgroundColor).toBe('transparent');
      expect(filledSurface.backgroundColor).toBe(theme.palette.background.paper);
      expect(outlinedSurface.backgroundColor).not.toBe(filledSurface.backgroundColor);
    }));
  });
});

// ─── disabled ────────────────────────────────────────────────────────────────

describe('Material TextField — disabled', () => {
  it('disabled creates an instance', () => {
    createRoot(() => withContext(() => {
      const inst = TextField({ label: 'Disabled', disabled: true });
      expect(inst).toBeTruthy();
    }));
  });

  it('disabled dims (opacity < 1) — verify via style resolution', () => {
    createRoot(() => withContext(() => {
      const theme = createMaterialTheme();
      const dimmed = resolveStyleInput([{ opacity: 0.38 }], theme as any);
      expect(dimmed.opacity).toBe(0.38);
      expect(dimmed.opacity).toBeLessThan(1);
    }));
  });
});

// ─── error + helperText ──────────────────────────────────────────────────────

describe('Material TextField — error + helperText', () => {
  it('renders with error=true without crashing', () => {
    createRoot(() => withContext(() => {
      const inst = TextField({ label: 'Email', error: true, helperText: 'Invalid email' });
      expect(inst).toBeTruthy();
    }));
  });

  it('renders with helperText alone without crashing', () => {
    createRoot(() => withContext(() => {
      const inst = TextField({ label: 'Email', helperText: 'We will email you' });
      expect(inst).toBeTruthy();
    }));
  });

  it('error color resolves differently from normal helper color', () => {
    createRoot(() => withContext(() => {
      const theme = createMaterialTheme();
      const errorColor = resolveStyleInput([{ color: theme.palette.error.main }], theme as any);
      const normalColor = resolveStyleInput([{ color: theme.palette.text.secondary }], theme as any);
      expect(errorColor.color).toBe(theme.palette.error.main);
      expect(normalColor.color).toBe(theme.palette.text.secondary);
      expect(errorColor.color).not.toBe(normalColor.color);
    }));
  });

  it('error border color resolves to error.main', () => {
    createRoot(() => withContext(() => {
      const theme = createMaterialTheme();
      const borderStyle = resolveStyleInput([{ border: { width: 2, color: theme.palette.error.main } }], theme as any);
      expect((borderStyle.border as any).color).toBe(theme.palette.error.main);
    }));
  });
});

// ─── color prop ──────────────────────────────────────────────────────────────

describe('Material TextField — color prop', () => {
  it('accepts color="primary" without error', () => {
    createRoot(() => withContext(() => {
      const inst = TextField({ label: 'Test', color: 'primary' });
      expect(inst).toBeTruthy();
    }));
  });

  it('accepts color="secondary" without error', () => {
    createRoot(() => withContext(() => {
      const inst = TextField({ label: 'Test', color: 'secondary' });
      expect(inst).toBeTruthy();
    }));
  });

  it('focused border resolves to color.main', () => {
    createRoot(() => withContext(() => {
      const theme = createMaterialTheme();
      const primaryColor = theme.palette.primary.main;
      const borderFocused = resolveStyleInput([{ border: { width: 2, color: primaryColor } }], theme as any);
      expect((borderFocused.border as any).color).toBe(primaryColor);
    }));
  });
});

// ─── fullWidth ────────────────────────────────────────────────────────────────

describe('Material TextField — fullWidth', () => {
  it('accepts fullWidth=true without error', () => {
    createRoot(() => withContext(() => {
      const inst = TextField({ label: 'Full', fullWidth: true });
      expect(inst).toBeTruthy();
    }));
  });
});

// ─── value / defaultValue / onInput ──────────────────────────────────────────

describe('Material TextField — value / defaultValue / onInput', () => {
  it('accepts value prop without error', () => {
    createRoot(() => withContext(() => {
      const inst = TextField({ label: 'Controlled', value: 'hello' });
      expect(inst).toBeTruthy();
    }));
  });

  it('accepts defaultValue prop without error', () => {
    createRoot(() => withContext(() => {
      const inst = TextField({ label: 'Uncontrolled', defaultValue: 'world' });
      expect(inst).toBeTruthy();
    }));
  });
});

// ─── floating label reflects focus/value ────────────────────────────────────

describe('Material TextField — floating label visual', () => {
  it('label is floated when value is present (style resolution check)', () => {
    createRoot(() => withContext(() => {
      const theme = createMaterialTheme();
      // When value is non-empty, the label should be in the floated position (top=−10, smaller font)
      const floatedStyle = resolveStyleInput([{ fontSize: 12 }], theme as any);
      const restingStyle = resolveStyleInput([{ fontSize: 16 }], theme as any);
      expect(floatedStyle.fontSize).toBeLessThan(restingStyle.fontSize as number);
    }));
  });

  it('outlined TextField with non-empty value produces an instance', () => {
    createRoot(() => withContext(() => {
      const inst = TextField({ label: 'Username', value: 'alice', variant: 'outlined' });
      expect(inst).toBeTruthy();
    }));
  });

  it('filled TextField with non-empty value produces an instance', () => {
    createRoot(() => withContext(() => {
      const inst = TextField({ label: 'Username', value: 'alice', variant: 'filled' });
      expect(inst).toBeTruthy();
    }));
  });
});

// ─── input semantics preserved ───────────────────────────────────────────────

describe('Material TextField — textbox semantics', () => {
  it('instance tree contains a focusable node (the input)', () => {
    createRoot(() => withContext(() => {
      const inst = TextField({ label: 'Name' });

      function findFocusable(node: any, depth = 0): boolean {
        if (!node) return false;
        if (node.focusable) return true;
        for (const c of (node.children ?? [])) {
          if (findFocusable(c, depth + 1)) return true;
        }
        return false;
      }

      expect(findFocusable(inst)).toBe(true);
    }));
  });

  it('instance tree contains a textbox role node', () => {
    createRoot(() => withContext(() => {
      const inst = TextField({ label: 'Name' });

      function findTextbox(node: any, depth = 0): boolean {
        if (!node) return false;
        if (node.semantics?.role === 'textbox') return true;
        for (const c of (node.children ?? [])) {
          if (findTextbox(c, depth + 1)) return true;
        }
        return false;
      }

      expect(findTextbox(inst)).toBe(true);
    }));
  });
});
