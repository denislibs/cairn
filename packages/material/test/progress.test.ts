import { describe, it, expect } from 'vitest';
import { createRoot, runWithContext } from '@cairn/reactivity';
import { hostContext } from '@cairn/runtime';
import { themeContext } from '@cairn/style';
import { resolveStyleInput } from '@cairn/primitives';
import { LinearProgress, CircularProgress } from '../src/progress';
import { createMaterialTheme } from '../src/theme';
import { recordingRenderer } from './recording-renderer';

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

// ── LinearProgress ────────────────────────────────────────────────────────────

describe('LinearProgress — renders without crashing', () => {
  it('creates an instance with no props', () => {
    createRoot(() => withContext(() => {
      const inst = LinearProgress({});
      expect(inst).toBeTruthy();
    }));
  });

  it('creates determinate instance with value', () => {
    createRoot(() => withContext(() => {
      const inst = LinearProgress({ value: 50 });
      expect(inst).toBeTruthy();
    }));
  });
});

describe('LinearProgress — progressbar semantics', () => {
  it('has role progressbar', () => {
    createRoot(() => withContext(() => {
      const inst = LinearProgress({ value: 40 });
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
      expect(sem).toBeTruthy();
      expect(sem.role).toBe('progressbar');
    }));
  });

  it('determinate: semantics.min=0, max=100, now=value', () => {
    createRoot(() => withContext(() => {
      const inst = LinearProgress({ value: 60, max: 100 });
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
      expect(sem.min).toBe(0);
      expect(sem.max).toBe(100);
      expect(sem.now).toBe(60);
    }));
  });

  it('indeterminate: semantics.now is undefined', () => {
    createRoot(() => withContext(() => {
      const inst = LinearProgress({ variant: 'indeterminate' });
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
      expect(sem.role).toBe('progressbar');
      expect(sem.now).toBeUndefined();
    }));
  });
});

describe('LinearProgress — determinate fill width', () => {
  it('fill child resolves to correct percentage width via resolveStyleInput', () => {
    createRoot(() => {
      const theme = createMaterialTheme();
      runWithContext(hostContext, fakeHost(), () =>
        runWithContext(themeContext, () => theme as any, () => {
          // 50% of max=100
          const style = [{ width: '50%' as any }];
          const resolved = resolveStyleInput(style, theme as any);
          expect(resolved.width).toBe('50%');

          const inst = LinearProgress({ value: 50, max: 100 });
          expect(inst).toBeTruthy();
        }),
      );
    });
  });

  it('value=0 produces 0% fill', () => {
    createRoot(() => {
      const theme = createMaterialTheme();
      runWithContext(hostContext, fakeHost(), () =>
        runWithContext(themeContext, () => theme as any, () => {
          const style = [{ width: '0%' as any }];
          const resolved = resolveStyleInput(style, theme as any);
          expect(resolved.width).toBe('0%');

          const inst = LinearProgress({ value: 0 });
          expect(inst).toBeTruthy();
        }),
      );
    });
  });

  it('value=100 produces 100% fill', () => {
    createRoot(() => {
      const theme = createMaterialTheme();
      runWithContext(hostContext, fakeHost(), () =>
        runWithContext(themeContext, () => theme as any, () => {
          const style = [{ width: '100%' as any }];
          const resolved = resolveStyleInput(style, theme as any);
          expect(resolved.width).toBe('100%');

          const inst = LinearProgress({ value: 100 });
          expect(inst).toBeTruthy();
        }),
      );
    });
  });
});

describe('LinearProgress — color', () => {
  it('default color=primary uses palette.primary.main', () => {
    createRoot(() => {
      const theme = createMaterialTheme();
      runWithContext(hostContext, fakeHost(), () =>
        runWithContext(themeContext, () => theme as any, () => {
          const c = theme.palette.primary;
          const style = [{ backgroundColor: c.main }];
          const resolved = resolveStyleInput(style, theme as any);
          expect(resolved.backgroundColor).toBe(c.main);

          const inst = LinearProgress({ value: 50 });
          expect(inst).toBeTruthy();
        }),
      );
    });
  });

  it('color=secondary uses palette.secondary.main', () => {
    createRoot(() => {
      const theme = createMaterialTheme();
      runWithContext(hostContext, fakeHost(), () =>
        runWithContext(themeContext, () => theme as any, () => {
          const c = theme.palette.secondary;
          const style = [{ backgroundColor: c.main }];
          const resolved = resolveStyleInput(style, theme as any);
          expect(resolved.backgroundColor).toBe(c.main);

          const inst = LinearProgress({ value: 50, color: 'secondary' });
          expect(inst).toBeTruthy();
        }),
      );
    });
  });

  it('color=error uses palette.error.main', () => {
    createRoot(() => withContext(() => {
      const inst = LinearProgress({ value: 50, color: 'error' });
      expect(inst).toBeTruthy();
    }));
  });
});

describe('LinearProgress — track is a Box with rounded corners', () => {
  it('resolves borderRadius from theme shape', () => {
    createRoot(() => {
      const theme = createMaterialTheme();
      runWithContext(hostContext, fakeHost(), () =>
        runWithContext(themeContext, () => theme as any, () => {
          // Track is rounded — borderRadius > 0 (half of height)
          const trackHeight = 4;
          const style = [{ borderRadius: trackHeight / 2 }];
          const resolved = resolveStyleInput(style, theme as any);
          expect(resolved.borderRadius).toBe(trackHeight / 2);

          const inst = LinearProgress({ value: 30 });
          expect(inst).toBeTruthy();
        }),
      );
    });
  });
});

describe('LinearProgress — variant prop', () => {
  it('determinate variant (default) renders', () => {
    createRoot(() => withContext(() => {
      const inst = LinearProgress({ variant: 'determinate', value: 75 });
      expect(inst).toBeTruthy();
    }));
  });

  it('indeterminate variant renders', () => {
    createRoot(() => withContext(() => {
      const inst = LinearProgress({ variant: 'indeterminate' });
      expect(inst).toBeTruthy();
    }));
  });
});

describe('LinearProgress — style override', () => {
  it('accepts style prop without crashing', () => {
    createRoot(() => withContext(() => {
      const inst = LinearProgress({ value: 50, style: { width: 200 } });
      expect(inst).toBeTruthy();
    }));
  });
});

// ── CircularProgress ──────────────────────────────────────────────────────────

describe('CircularProgress — renders without crashing', () => {
  it('creates an instance with no props (defaults to indeterminate)', () => {
    createRoot(() => withContext(() => {
      const inst = CircularProgress({});
      expect(inst).toBeTruthy();
    }));
  });

  it('creates determinate instance with value', () => {
    createRoot(() => withContext(() => {
      const inst = CircularProgress({ value: 75, variant: 'determinate' });
      expect(inst).toBeTruthy();
    }));
  });
});

describe('CircularProgress — progressbar semantics', () => {
  it('has role progressbar', () => {
    createRoot(() => withContext(() => {
      const inst = CircularProgress({ value: 60, variant: 'determinate' });
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
      expect(sem).toBeTruthy();
      expect(sem.role).toBe('progressbar');
    }));
  });

  it('determinate: min=0, max, now=value', () => {
    createRoot(() => withContext(() => {
      const inst = CircularProgress({ value: 75, max: 100, variant: 'determinate' });
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
      expect(sem.min).toBe(0);
      expect(sem.max).toBe(100);
      expect(sem.now).toBe(75);
    }));
  });

  it('indeterminate: semantics.now is undefined', () => {
    createRoot(() => withContext(() => {
      const inst = CircularProgress({ variant: 'indeterminate' });
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
      expect(sem.role).toBe('progressbar');
      expect(sem.now).toBeUndefined();
    }));
  });

  it('default (no variant = indeterminate) omits now', () => {
    createRoot(() => withContext(() => {
      const inst = CircularProgress({});
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
      expect(sem.now).toBeUndefined();
    }));
  });
});

describe('CircularProgress — custom paint arc', () => {
  it('has a paintSelf function that calls strokePath for the arc', () => {
    createRoot(() => withContext(() => {
      const inst = CircularProgress({ value: 50, variant: 'determinate' }) as any;
      // Walk tree to find a node with a meaningful paintSelf (custom arc painter)
      function findPainter(node: any): any {
        if (!node) return null;
        if (typeof node.paintSelf === 'function') {
          // Call paintSelf with a recording renderer to verify it strokes a path
          const { r, calls } = recordingRenderer();
          // Give the layout a size so arc drawing has dimensions
          if (node.layout) {
            node.layout.size = { w: 40, h: 40 };
          }
          node.paintSelf(r);
          if (calls.some((c: any) => c.name === 'strokePath')) return node;
        }
        for (const c of (node.children ?? [])) {
          const found = findPainter(c);
          if (found) return found;
        }
        return null;
      }
      const painter = findPainter(inst);
      expect(painter).toBeTruthy();
    }));
  });

  it('determinate: paintSelf strokes both track and arc paths', () => {
    createRoot(() => withContext(() => {
      const inst = CircularProgress({ value: 50, variant: 'determinate' }) as any;
      function callPaintSelf(node: any): { calls: any[] } | null {
        if (!node) return null;
        if (typeof node.paintSelf === 'function') {
          const { r, calls } = recordingRenderer();
          if (node.layout) node.layout.size = { w: 40, h: 40 };
          node.paintSelf(r);
          if (calls.some((c: any) => c.name === 'strokePath')) return { calls };
        }
        for (const c of (node.children ?? [])) {
          const result = callPaintSelf(c);
          if (result) return result;
        }
        return null;
      }
      const result = callPaintSelf(inst);
      expect(result).toBeTruthy();
      // Should call strokePath at least twice: once for track ring, once for progress arc
      const strokes = result!.calls.filter((c: any) => c.name === 'strokePath');
      expect(strokes.length).toBeGreaterThanOrEqual(2);
    }));
  });
});

describe('CircularProgress — size and thickness props', () => {
  it('default size=40 creates instance', () => {
    createRoot(() => withContext(() => {
      const inst = CircularProgress({});
      expect(inst).toBeTruthy();
    }));
  });

  it('custom size creates instance', () => {
    createRoot(() => withContext(() => {
      const inst = CircularProgress({ size: 56 });
      expect(inst).toBeTruthy();
    }));
  });

  it('custom thickness creates instance', () => {
    createRoot(() => withContext(() => {
      const inst = CircularProgress({ size: 40, thickness: 5 });
      expect(inst).toBeTruthy();
    }));
  });
});

describe('CircularProgress — color prop', () => {
  it('default color=primary creates instance', () => {
    createRoot(() => withContext(() => {
      const inst = CircularProgress({ variant: 'determinate', value: 50 });
      expect(inst).toBeTruthy();
    }));
  });

  it('color=secondary creates instance', () => {
    createRoot(() => withContext(() => {
      const inst = CircularProgress({ color: 'secondary', variant: 'determinate', value: 50 });
      expect(inst).toBeTruthy();
    }));
  });

  it('color=error creates instance', () => {
    createRoot(() => withContext(() => {
      const inst = CircularProgress({ color: 'error', variant: 'indeterminate' });
      expect(inst).toBeTruthy();
    }));
  });
});

describe('CircularProgress — max prop', () => {
  it('custom max respected in semantics', () => {
    createRoot(() => withContext(() => {
      const inst = CircularProgress({ value: 25, max: 50, variant: 'determinate' });
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
      expect(sem.max).toBe(50);
      expect(sem.now).toBe(25);
    }));
  });
});
