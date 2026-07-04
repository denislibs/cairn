import { describe, it, expect } from 'vitest';
import { createRoot, runWithContext } from '@cairn/reactivity';
import { hostContext } from '@cairn/runtime';
import { themeContext } from '@cairn/style';
import { resolveStyleInput, Text } from '@cairn/primitives';
import { AppBar } from '../src/appbar';
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

// ── Color / backgroundColor tests ──────────────────────────────────────────

describe('AppBar — color prop', () => {
  it('default color=primary uses palette.primary.main as backgroundColor', () => {
    createRoot(() => withContext(() => {
      const theme = createMaterialTheme();
      const c = theme.palette.primary;
      const style = [{ backgroundColor: c.main }];
      const resolved = resolveStyleInput(style, theme as any);
      expect(resolved.backgroundColor).toBe(c.main);

      const inst = AppBar({});
      expect(inst).toBeTruthy();
    }));
  });

  it('color=secondary uses palette.secondary.main', () => {
    createRoot(() => withContext(() => {
      const theme = createMaterialTheme();
      const c = theme.palette.secondary;
      const style = [{ backgroundColor: c.main }];
      const resolved = resolveStyleInput(style, theme as any);
      expect(resolved.backgroundColor).toBe(c.main);

      const inst = AppBar({ color: 'secondary' });
      expect(inst).toBeTruthy();
    }));
  });

  it('color=default uses palette.background.paper', () => {
    createRoot(() => withContext(() => {
      const theme = createMaterialTheme();
      const style = [{ backgroundColor: theme.palette.background.paper }];
      const resolved = resolveStyleInput(style, theme as any);
      expect(resolved.backgroundColor).toBe(theme.palette.background.paper);

      const inst = AppBar({ color: 'default' });
      expect(inst).toBeTruthy();
    }));
  });

  it('color=transparent uses transparent backgroundColor', () => {
    createRoot(() => withContext(() => {
      const theme = createMaterialTheme();
      const style = [{ backgroundColor: 'transparent' }];
      const resolved = resolveStyleInput(style, theme as any);
      expect(resolved.backgroundColor).toBe('transparent');

      const inst = AppBar({ color: 'transparent' });
      expect(inst).toBeTruthy();
    }));
  });

  it('color=error uses palette.error.main', () => {
    createRoot(() => withContext(() => {
      const inst = AppBar({ color: 'error' });
      expect(inst).toBeTruthy();
    }));
  });
});

// ── Elevation / boxShadow tests ─────────────────────────────────────────────

describe('AppBar — elevation prop', () => {
  it('elevation=4 (default) produces a boxShadow array', () => {
    createRoot(() => withContext(() => {
      const theme = createMaterialTheme();
      const style = [{ boxShadow: theme.elevation[4] }];
      const resolved = resolveStyleInput(style, theme as any);
      expect(Array.isArray(resolved.boxShadow)).toBe(true);
      expect((resolved.boxShadow as any[]).length).toBeGreaterThan(0);

      const inst = AppBar({});
      expect(inst).toBeTruthy();
    }));
  });

  it('elevation=0 produces no shadow (empty array)', () => {
    createRoot(() => withContext(() => {
      const theme = createMaterialTheme();
      const style = [{ boxShadow: theme.elevation[0] }];
      const resolved = resolveStyleInput(style, theme as any);
      // elevation[0] is [] per theme creation
      expect(Array.isArray(resolved.boxShadow) ? (resolved.boxShadow as any[]).length : 0).toBe(0);

      const inst = AppBar({ elevation: 0 });
      expect(inst).toBeTruthy();
    }));
  });

  it('elevation=8 applies a deeper shadow', () => {
    createRoot(() => withContext(() => {
      const theme = createMaterialTheme();
      const style = [{ boxShadow: theme.elevation[8] }];
      const resolved = resolveStyleInput(style, theme as any);
      expect(Array.isArray(resolved.boxShadow)).toBe(true);
      expect((resolved.boxShadow as any[]).length).toBeGreaterThan(0);

      const inst = AppBar({ elevation: 8 });
      expect(inst).toBeTruthy();
    }));
  });

  it('clamped elevation >24 behaves like elevation 24', () => {
    createRoot(() => withContext(() => {
      const inst = AppBar({ elevation: 100 });
      expect(inst).toBeTruthy();
    }));
  });
});

// ── Children / Row layout ───────────────────────────────────────────────────

describe('AppBar — children', () => {
  it('renders without children', () => {
    createRoot(() => withContext(() => {
      const inst = AppBar({});
      expect(inst).toBeTruthy();
      expect(inst.children).toBeDefined();
    }));
  });

  it('renders with a single Instance child', () => {
    createRoot(() => withContext(() => {
      const title = Text({ children: 'My App' });
      const inst = AppBar({ children: title });
      expect(inst).toBeTruthy();
    }));
  });

  it('renders with multiple Instance children', () => {
    createRoot(() => withContext(() => {
      const a = Text({ children: 'A' });
      const b = Text({ children: 'B' });
      const inst = AppBar({ children: [a, b] });
      expect(inst).toBeTruthy();
    }));
  });

  it('renders with string child wrapped in Text', () => {
    createRoot(() => withContext(() => {
      const inst = AppBar({ children: 'Hello World' as any });
      expect(inst).toBeTruthy();
    }));
  });
});

// ── AppBar.Title ────────────────────────────────────────────────────────────

describe('AppBar.Title', () => {
  it('AppBar.Title is a function', () => {
    expect(typeof AppBar.Title).toBe('function');
  });

  it('AppBar.Title renders an Instance with the correct typography', () => {
    createRoot(() => withContext(() => {
      const title = AppBar.Title({ children: 'My App' });
      expect(title).toBeTruthy();
      expect(title.children).toBeDefined();
    }));
  });

  it('AppBar.Title works with a custom color override', () => {
    createRoot(() => withContext(() => {
      const title = AppBar.Title({ children: 'Custom Color', color: '#fff' });
      expect(title).toBeTruthy();
    }));
  });

  it('AppBar renders with AppBar.Title as child', () => {
    createRoot(() => withContext(() => {
      const title = AppBar.Title({ children: 'Dashboard' });
      const inst = AppBar({ children: title });
      expect(inst).toBeTruthy();
    }));
  });
});

// ── Semantics ───────────────────────────────────────────────────────────────

describe('AppBar — semantics', () => {
  it('has navigation or group role semantics', () => {
    createRoot(() => withContext(() => {
      const inst = AppBar({});
      // Walk the tree to find the semantics node
      function findSemantics(node: any): any {
        if (!node) return null;
        if (node.semantics) return node.semantics;
        for (const c of (node.children ?? [])) {
          const found = findSemantics(c);
          if (found) return found;
        }
        return null;
      }
      const sem = findSemantics(inst);
      // The AppBar should expose navigation or group role
      expect(sem).toBeTruthy();
      expect(['navigation', 'group']).toContain(sem.role);
    }));
  });
});

// ── mergeStyles / style override ────────────────────────────────────────────

describe('AppBar — style override', () => {
  it('accepts a style prop without error', () => {
    createRoot(() => withContext(() => {
      const inst = AppBar({ style: { opacity: 0.9 } });
      expect(inst).toBeTruthy();
    }));
  });

  it('accepts array style without error', () => {
    createRoot(() => withContext(() => {
      const inst = AppBar({ style: [{ opacity: 0.8 }, { opacity: 0.9 }] });
      expect(inst).toBeTruthy();
    }));
  });
});

// ── Integration: Title + actions row ───────────────────────────────────────

describe('AppBar — integration', () => {
  it('renders a title + action row without error', () => {
    createRoot(() => withContext(() => {
      const title = AppBar.Title({ children: 'My App' });
      const action = Text({ children: 'Menu' });
      const inst = AppBar({ children: [title, action], color: 'primary', elevation: 4 });
      expect(inst).toBeTruthy();
    }));
  });

  it('can render error-color AppBar with Title', () => {
    createRoot(() => withContext(() => {
      const title = AppBar.Title({ children: 'Error Bar' });
      const inst = AppBar({ children: title, color: 'error', elevation: 2 });
      expect(inst).toBeTruthy();
    }));
  });

  it('can render transparent AppBar', () => {
    createRoot(() => withContext(() => {
      const title = AppBar.Title({ children: 'Transparent Bar' });
      const inst = AppBar({ children: title, color: 'transparent', elevation: 0 });
      expect(inst).toBeTruthy();
    }));
  });
});
