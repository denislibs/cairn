import { describe, it, expect } from 'vitest';
import { createRoot, runWithContext } from '@cairn/reactivity';
import { hostContext } from '@cairn/runtime';
import { themeContext } from '@cairn/style';
import { Text } from '@cairn/primitives';
import { Badge } from '../src/badge';
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

describe('Material Badge — renders', () => {
  it('creates a standalone badge without crashing', () => {
    createRoot(() => withContext(() => {
      const inst = Badge({ badgeContent: 5 });
      expect(inst).toBeTruthy();
    }));
  });

  it('creates a badge with a child (overlay mode)', () => {
    createRoot(() => withContext(() => {
      const child = Text({ children: 'icon' });
      const inst = Badge({ children: child, badgeContent: 3 });
      expect(inst).toBeTruthy();
    }));
  });

  it('creates a dot badge without crashing', () => {
    createRoot(() => withContext(() => {
      const inst = Badge({ variant: 'dot' });
      expect(inst).toBeTruthy();
    }));
  });
});

// ─── count over max → max+ ────────────────────────────────────────────────────

describe('Material Badge — count over max renders max+', () => {
  /** Walk the tree collecting TextNode text values. */
  function collectLayoutText(node: any): string[] {
    const results: string[] = [];
    // Text instance: layout is a TextNode with a `.text` property
    if (node?.layout?.text !== undefined) results.push(node.layout.text);
    for (const c of (node?.children ?? [])) results.push(...collectLayoutText(c));
    return results;
  }

  it('content=150 with default max=99 renders "99+"', () => {
    createRoot(() => {
      const theme = createMaterialTheme();
      runWithContext(hostContext, fakeHost(), () =>
        runWithContext(themeContext, () => theme as any, () => {
          const inst = Badge({ badgeContent: 150 });
          const texts = collectLayoutText(inst);
          expect(texts.some((t) => t === '99+')).toBe(true);
        }),
      );
    });
  });

  it('content=5 with max=3 renders "3+"', () => {
    createRoot(() => {
      const theme = createMaterialTheme();
      runWithContext(hostContext, fakeHost(), () =>
        runWithContext(themeContext, () => theme as any, () => {
          const inst = Badge({ badgeContent: 5, max: 3 });
          const texts = collectLayoutText(inst);
          expect(texts.some((t) => t === '3+')).toBe(true);
        }),
      );
    });
  });

  it('content=50 within default max=99 renders "50"', () => {
    createRoot(() => {
      const theme = createMaterialTheme();
      runWithContext(hostContext, fakeHost(), () =>
        runWithContext(themeContext, () => theme as any, () => {
          const inst = Badge({ badgeContent: 50 });
          const texts = collectLayoutText(inst);
          expect(texts.some((t) => t === '50')).toBe(true);
        }),
      );
    });
  });
});

// ─── dot variant ──────────────────────────────────────────────────────────────

describe('Material Badge — dot variant', () => {
  it('dot variant produces no text content', () => {
    createRoot(() => {
      const theme = createMaterialTheme();
      runWithContext(hostContext, fakeHost(), () =>
        runWithContext(themeContext, () => theme as any, () => {
          const inst = Badge({ variant: 'dot' });
          function collectText(node: any): string[] {
            const results: string[] = [];
            if (node?.text !== undefined) results.push(node.text);
            if (node?.children && node.children.length) {
              for (const c of node.children) results.push(...collectText(c));
            }
            return results;
          }
          const texts = collectText(inst).filter((t) => t.length > 0);
          expect(texts.length).toBe(0);
        }),
      );
    });
  });

  it('dot variant semantics role is none (decorative)', () => {
    createRoot(() => withContext(() => {
      const inst = Badge({ variant: 'dot' }) as any;
      // Dot badge: either the returned node has role none, or find it in the tree
      function findRole(node: any, role: string): boolean {
        if (!node) return false;
        if (node.semantics?.role === role || node.role === role) return true;
        for (const c of (node.children ?? [])) {
          if (findRole(c, role)) return true;
        }
        return false;
      }
      expect(findRole(inst, 'none')).toBe(true);
    }));
  });

  it('dot variant is smaller than standard pill (width 8, height 8)', () => {
    createRoot(() => {
      const theme = createMaterialTheme();
      runWithContext(hostContext, fakeHost(), () =>
        runWithContext(themeContext, () => theme as any, () => {
          // Dot badge should render a small fixed-size node
          const inst = Badge({ variant: 'dot' });
          expect(inst).toBeTruthy();
          // Spot-check: the instance subtree should contain a node with width=8 or height=8
          function findDotSize(node: any): boolean {
            if (!node) return false;
            const w = node.layout?.width ?? node.style?.width;
            const h = node.layout?.height ?? node.style?.height;
            if (w === 8 || h === 8) return true;
            for (const c of (node.children ?? [])) {
              if (findDotSize(c)) return true;
            }
            return false;
          }
          expect(findDotSize(inst)).toBe(true);
        }),
      );
    });
  });
});

// ─── overlay on child ─────────────────────────────────────────────────────────

describe('Material Badge — overlay on child', () => {
  it('when children provided, child appears in tree', () => {
    createRoot(() => withContext(() => {
      const child = Text({ children: 'icon' });
      const inst = Badge({ children: child, badgeContent: 7 });
      function findChild(node: any, target: any): boolean {
        if (node === target) return true;
        for (const c of (node.children ?? [])) {
          if (findChild(c, target)) return true;
        }
        return false;
      }
      expect(findChild(inst, child)).toBe(true);
    }));
  });

  it('when no children, returns standalone badge node', () => {
    createRoot(() => withContext(() => {
      const inst = Badge({ badgeContent: 2 });
      expect(inst).toBeTruthy();
      // Standalone: no stack wrapping needed — just the pill
    }));
  });

  it('standard badge semantics role is status', () => {
    createRoot(() => withContext(() => {
      const inst = Badge({ badgeContent: 5 }) as any;
      function findRole(node: any, role: string): boolean {
        if (!node) return false;
        if (node.semantics?.role === role || node.role === role) return true;
        for (const c of (node.children ?? [])) {
          if (findRole(c, role)) return true;
        }
        return false;
      }
      expect(findRole(inst, 'status')).toBe(true);
    }));
  });
});

// ─── color applied ────────────────────────────────────────────────────────────

describe('Material Badge — color applied', () => {
  /** Walk the tree to find a node with `_bgColor` matching `color`. */
  function findBgColor(node: any, color: string): boolean {
    if (!node) return false;
    if (node._bgColor === color) return true;
    for (const c of (node.children ?? [])) {
      if (findBgColor(c, color)) return true;
    }
    return false;
  }

  it('default color is primary — badge _bgColor matches palette.primary.main', () => {
    createRoot(() => {
      const theme = createMaterialTheme();
      runWithContext(hostContext, fakeHost(), () =>
        runWithContext(themeContext, () => theme as any, () => {
          const primaryMain = theme.palette.primary.main;
          const inst = Badge({ badgeContent: 1 });
          expect(findBgColor(inst, primaryMain)).toBe(true);
        }),
      );
    });
  });

  it('error color badge _bgColor matches palette.error.main', () => {
    createRoot(() => {
      const theme = createMaterialTheme();
      runWithContext(hostContext, fakeHost(), () =>
        runWithContext(themeContext, () => theme as any, () => {
          const errorMain = theme.palette.error.main;
          const inst = Badge({ badgeContent: 1, color: 'error' });
          expect(findBgColor(inst, errorMain)).toBe(true);
        }),
      );
    });
  });

  it('accepts all MaterialColor values without crashing', () => {
    createRoot(() => withContext(() => {
      const colors = ['primary', 'secondary', 'error', 'warning', 'info', 'success'] as const;
      for (const color of colors) {
        const inst = Badge({ badgeContent: 1, color });
        expect(inst).toBeTruthy();
      }
    }));
  });
});

// ─── style override ───────────────────────────────────────────────────────────

describe('Material Badge — style override', () => {
  it('accepts a style prop without crashing', () => {
    createRoot(() => withContext(() => {
      const inst = Badge({ badgeContent: 1, style: { opacity: 0.8 } });
      expect(inst).toBeTruthy();
    }));
  });
});
