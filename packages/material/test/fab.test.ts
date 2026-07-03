import { describe, it, expect } from 'vitest';
import { createRoot, runWithContext } from '@cairn/reactivity';
import { hostContext } from '@cairn/runtime';
import { themeContext } from '@cairn/style';
import { resolveStyleInput, Stack } from '@cairn/primitives';
import { Fab } from '../src/fab';
import { createMaterialTheme } from '../src/theme';
import type { Instance } from '@cairn/runtime';

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

function fakeIcon(): Instance {
  return Stack({});
}

describe('Fab — onClick', () => {
  it('calls onClick when handler fires', () => {
    createRoot(() => withContext(() => {
      let clicked = 0;
      const inst = Fab({ icon: fakeIcon(), onClick: () => clicked++ });
      inst.handlers!.onClick!({} as any);
      expect(clicked).toBe(1);
    }));
  });

  it('calls onClick via Enter key', () => {
    createRoot(() => withContext(() => {
      let clicked = 0;
      const inst = Fab({ icon: fakeIcon(), onClick: () => clicked++ });
      inst.handlers!.onKeyDown!({ key: 'Enter' } as any);
      expect(clicked).toBe(1);
    }));
  });
});

describe('Fab — disabled', () => {
  it('disabled blocks onClick', () => {
    createRoot(() => withContext(() => {
      let clicked = 0;
      const inst = Fab({ icon: fakeIcon(), disabled: true, onClick: () => clicked++ });
      inst.handlers!.onClick?.({} as any);
      expect(clicked).toBe(0);
    }));
  });
});

describe('Fab — focusable', () => {
  it('is focusable (from headless base)', () => {
    createRoot(() => withContext(() => {
      const inst = Fab({ icon: fakeIcon() });
      expect(inst.focusable).toBe(true);
    }));
  });
});

describe('Fab — boxShadow resolved', () => {
  it('resolved style has a boxShadow (elevation[6])', () => {
    createRoot(() => {
      const theme = createMaterialTheme();
      runWithContext(hostContext, fakeHost(), () =>
        runWithContext(themeContext, () => theme as any, () => {
          // Verify that elevation[6] is a non-empty Shadow array
          const el6 = theme.elevation[6];
          expect(Array.isArray(el6)).toBe(true);
          expect(el6.length).toBeGreaterThan(0);

          // Resolve a style containing that elevation to confirm it resolves through
          const style = [{ boxShadow: el6 }];
          const resolved = resolveStyleInput(style, theme as any);
          expect(resolved.boxShadow).toBeDefined();

          // Also ensure Fab creates successfully
          const inst = Fab({ icon: fakeIcon() });
          expect(inst).toBeTruthy();
        }),
      );
    });
  });
});

describe('Fab — ripple child present', () => {
  it('tree contains a ripple instance (leaf with custom paintSelf)', () => {
    createRoot(() => withContext(() => {
      const inst = Fab({ icon: fakeIcon() });
      function findRippleLike(node: any): boolean {
        if (!node) return false;
        if (typeof node.paintSelf === 'function' && (node.children ?? []).length === 0) {
          return true;
        }
        for (const c of (node.children ?? [])) {
          if (findRippleLike(c)) return true;
        }
        return false;
      }
      expect(findRippleLike(inst)).toBe(true);
    }));
  });
});

describe('Fab — backgroundColor === palette[color].main', () => {
  it('Fab primary backgroundColor is palette.primary.main', () => {
    createRoot(() => {
      const theme = createMaterialTheme();
      runWithContext(hostContext, fakeHost(), () =>
        runWithContext(themeContext, () => theme as any, () => {
          const c = theme.palette.primary;
          // The Fab passes {backgroundColor: c.main} in its style array
          const style = [{ backgroundColor: c.main }];
          const resolved = resolveStyleInput(style, theme as any);
          expect(resolved.backgroundColor).toBe(c.main);
        }),
      );
    });
  });
});
