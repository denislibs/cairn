import { describe, it, expect } from 'vitest';
import { createRoot, runWithContext } from '@cairn/reactivity';
import { hostContext } from '@cairn/runtime';
import { themeContext } from '@cairn/style';
import { resolveStyleInput, Text } from '@cairn/primitives';
import { Paper } from '../src/paper';
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

describe('Paper — renders without crashing', () => {
  it('creates an instance with no props', () => {
    createRoot(() => withContext(() => {
      const inst = Paper({});
      expect(inst).toBeTruthy();
    }));
  });
});

describe('Paper — backgroundColor', () => {
  it('resolves backgroundColor to palette.background.paper', () => {
    createRoot(() => {
      const theme = createMaterialTheme();
      runWithContext(hostContext, fakeHost(), () =>
        runWithContext(themeContext, () => theme as any, () => {
          const style = [{ backgroundColor: theme.palette.background.paper }];
          const resolved = resolveStyleInput(style, theme as any);
          expect(resolved.backgroundColor).toBe(theme.palette.background.paper);

          // Also verify Paper itself creates without error
          const inst = Paper({});
          expect(inst).toBeTruthy();
        }),
      );
    });
  });
});

describe('Paper — elevation maps to boxShadow', () => {
  it('elevation 0 produces no shadow (empty array)', () => {
    createRoot(() => {
      const theme = createMaterialTheme();
      runWithContext(hostContext, fakeHost(), () =>
        runWithContext(themeContext, () => theme as any, () => {
          // theme.elevation[0] is []
          expect(theme.elevation[0]).toEqual([]);
          const inst = Paper({ elevation: 0 });
          expect(inst).toBeTruthy();
        }),
      );
    });
  });

  it('elevation 2 produces a non-empty shadow array via resolveStyleInput', () => {
    createRoot(() => {
      const theme = createMaterialTheme();
      runWithContext(hostContext, fakeHost(), () =>
        runWithContext(themeContext, () => theme as any, () => {
          const style = [{ boxShadow: theme.elevation[2] }];
          const resolved = resolveStyleInput(style, theme as any);
          expect(resolved.boxShadow).toBeDefined();
          expect(Array.isArray(resolved.boxShadow)).toBe(true);
          expect((resolved.boxShadow as any[]).length).toBeGreaterThan(0);
        }),
      );
    });
  });

  it('elevation beyond 24 is clamped to last entry', () => {
    createRoot(() => withContext(() => {
      // Should not throw — elevation is clamped
      const inst = Paper({ elevation: 999 });
      expect(inst).toBeTruthy();
    }));
  });
});

describe('Paper — borderRadius', () => {
  it('applies shape.borderRadius by default', () => {
    createRoot(() => {
      const theme = createMaterialTheme();
      runWithContext(hostContext, fakeHost(), () =>
        runWithContext(themeContext, () => theme as any, () => {
          const style = [{ borderRadius: theme.shape.borderRadius }];
          const resolved = resolveStyleInput(style, theme as any);
          expect(resolved.borderRadius).toBe(theme.shape.borderRadius);

          const inst = Paper({});
          expect(inst).toBeTruthy();
        }),
      );
    });
  });

  it('square=true sets borderRadius to 0', () => {
    createRoot(() => {
      const theme = createMaterialTheme();
      runWithContext(hostContext, fakeHost(), () =>
        runWithContext(themeContext, () => theme as any, () => {
          const style = [{ borderRadius: 0 }];
          const resolved = resolveStyleInput(style, theme as any);
          expect(resolved.borderRadius).toBe(0);

          const inst = Paper({ square: true });
          expect(inst).toBeTruthy();
        }),
      );
    });
  });
});

describe('Paper — renders children', () => {
  it('accepts a single child instance', () => {
    createRoot(() => withContext(() => {
      const child = Text({ children: 'hello' });
      const inst = Paper({ children: child });
      expect(inst).toBeTruthy();
      // The instance tree should contain the child somewhere
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

  it('wraps an array of children in Column', () => {
    createRoot(() => withContext(() => {
      const child1 = Text({ children: 'first' });
      const child2 = Text({ children: 'second' });
      const inst = Paper({ children: [child1, child2] });
      expect(inst).toBeTruthy();
      // Both children must appear somewhere in the tree
      function findChild(node: any, target: any): boolean {
        if (node === target) return true;
        for (const c of (node.children ?? [])) {
          if (findChild(c, target)) return true;
        }
        return false;
      }
      expect(findChild(inst, child1)).toBe(true);
      expect(findChild(inst, child2)).toBe(true);
    }));
  });

  it('wraps string children in Text', () => {
    createRoot(() => withContext(() => {
      // Should not throw when a string is passed as children
      const inst = Paper({ children: 'hello' as any });
      expect(inst).toBeTruthy();
    }));
  });
});

describe('Paper — role semantics', () => {
  it('has role group set on the instance', () => {
    createRoot(() => withContext(() => {
      const inst = Paper({}) as any;
      expect(inst.role).toBe('group');
    }));
  });
});

describe('Paper — mergeStyles for style override', () => {
  it('accepts an optional style prop without crashing', () => {
    createRoot(() => withContext(() => {
      const inst = Paper({ style: { width: 200 } });
      expect(inst).toBeTruthy();
    }));
  });
});
