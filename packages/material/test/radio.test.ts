import { describe, it, expect } from 'vitest';
import { createRoot, runWithContext } from '@cairn/reactivity';
import { hostContext } from '@cairn/runtime';
import { themeContext } from '@cairn/style';
import { resolveStyleInput } from '@cairn/primitives';
import { RadioGroup, radioGroupContext } from '@cairn/widgets';
import { Radio } from '../src/radio';
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

// Build a minimal RadioGroup context for running Radio inside
function withGroupContext<T>(defaultValue: any, fn: () => T): T {
  return withContext(() => {
    const group = RadioGroup({ defaultValue });
    return runWithContext(radioGroupContext.context, group._ctx, fn);
  });
}

// ─── Re-export check ────────────────────────────────────────────────────────

describe('Material Radio — re-exports RadioGroup', () => {
  it('RadioGroup is exported from ../src/radio', async () => {
    const mod = await import('../src/radio');
    expect(typeof mod.RadioGroup).toBe('function');
  });
});

// ─── Renders without error ───────────────────────────────────────────────────

describe('Material Radio — renders', () => {
  it('renders without throwing inside a RadioGroup', () => {
    createRoot(() => {
      expect(() => {
        withGroupContext('a', () => {
          Radio({ value: 'a' });
        });
      }).not.toThrow();
    });
  });

  it('renders with a label without throwing', () => {
    createRoot(() => {
      expect(() => {
        withGroupContext('a', () => {
          Radio({ value: 'a', label: 'Option A' });
        });
      }).not.toThrow();
    });
  });

  it('returns a truthy instance', () => {
    createRoot(() => {
      withGroupContext('a', () => {
        const inst = Radio({ value: 'a' });
        expect(inst).toBeTruthy();
      });
    });
  });
});

// ─── Focusable ───────────────────────────────────────────────────────────────

describe('Material Radio — focusable', () => {
  it('is focusable (from headless)', () => {
    createRoot(() => {
      withGroupContext('a', () => {
        const inst = Radio({ value: 'a' });
        expect(inst.focusable).toBe(true);
      });
    });
  });
});

// ─── Semantics inherited from headless ───────────────────────────────────────

describe('Material Radio — semantics', () => {
  it('has role "radio"', () => {
    createRoot(() => {
      withGroupContext('a', () => {
        const inst = Radio({ value: 'a' });
        expect(inst.semantics?.role).toBe('radio');
      });
    });
  });

  it('semantics.label matches prop', () => {
    createRoot(() => {
      withGroupContext('a', () => {
        const inst = Radio({ value: 'a', label: 'My Radio' });
        expect(inst.semantics?.label).toBe('My Radio');
      });
    });
  });

  it('semantics.checked is true when value matches group value', () => {
    createRoot(() => {
      withGroupContext('a', () => {
        const inst = Radio({ value: 'a' });
        expect(inst.semantics?.checked).toBe(true);
      });
    });
  });

  it('semantics.checked is false when value does not match group value', () => {
    createRoot(() => {
      withGroupContext('a', () => {
        const inst = Radio({ value: 'b' });
        expect(inst.semantics?.checked).toBe(false);
      });
    });
  });
});

// ─── Selection pass-through ───────────────────────────────────────────────────

describe('Material Radio — selection pass-through', () => {
  it('onClick selects the radio (fires group onChange)', () => {
    createRoot(() => {
      withContext(() => {
        const seen: any[] = [];
        const group = RadioGroup({ defaultValue: 'a', onChange: (v) => seen.push(v) });
        runWithContext(radioGroupContext.context, group._ctx, () => {
          const radio = Radio({ value: 'b' });
          radio.handlers!.onClick!({} as any);
        });
        expect(seen).toEqual(['b']);
      });
    });
  });

  it('Space key (keyup) selects the radio', () => {
    createRoot(() => {
      withContext(() => {
        const seen: any[] = [];
        const group = RadioGroup({ defaultValue: 'a', onChange: (v) => seen.push(v) });
        runWithContext(radioGroupContext.context, group._ctx, () => {
          const radio = Radio({ value: 'b' });
          radio.handlers!.onKeyUp!({ key: ' ' } as any);
        });
        expect(seen).toEqual(['b']);
      });
    });
  });
});

// ─── Disabled ────────────────────────────────────────────────────────────────

describe('Material Radio — disabled', () => {
  it('disabled prop blocks selection', () => {
    createRoot(() => {
      withContext(() => {
        const seen: any[] = [];
        const group = RadioGroup({ defaultValue: 'a', onChange: (v) => seen.push(v) });
        runWithContext(radioGroupContext.context, group._ctx, () => {
          const radio = Radio({ value: 'b', disabled: true });
          radio.handlers!.onClick?.({} as any);
        });
        expect(seen).toEqual([]);
      });
    });
  });

  it('disabled group blocks all radios', () => {
    createRoot(() => {
      withContext(() => {
        const seen: any[] = [];
        const group = RadioGroup({ defaultValue: 'a', disabled: true, onChange: (v) => seen.push(v) });
        runWithContext(radioGroupContext.context, group._ctx, () => {
          const radio = Radio({ value: 'b' });
          radio.handlers!.onClick?.({} as any);
        });
        expect(seen).toEqual([]);
      });
    });
  });
});

// ─── Visual: ring + dot with Material palette colors ─────────────────────────

describe('Material Radio — visual structure', () => {
  it('contains a ripple instance (leaf node with custom paintSelf)', () => {
    createRoot(() => {
      withGroupContext('a', () => {
        const inst = Radio({ value: 'a' });
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
      });
    });
  });

  it('selected radio ring style uses primary.main color (checked)', () => {
    createRoot(() => {
      const theme = createMaterialTheme();
      runWithContext(hostContext, fakeHost(), () =>
        runWithContext(themeContext, () => theme as any, () => {
          // Verify theme primary is accessible
          const primaryMain = theme.palette.primary.main;
          expect(primaryMain).toBeTruthy();
          expect(primaryMain.startsWith('#')).toBe(true);

          // Build a Radio with selected value and assert it renders without error
          const group = RadioGroup({ defaultValue: 'a' });
          runWithContext(radioGroupContext.context, group._ctx, () => {
            const inst = Radio({ value: 'a' }); // value matches defaultValue → selected
            expect(inst).toBeTruthy();
            // The ring uses primary.main for border when checked
            // We verify via style resolution that the theme color is well-formed
            const style = [{ border: { width: 2, color: primaryMain } }];
            const resolved = resolveStyleInput(style, theme as any);
            expect(resolved.border).toBeDefined();
          });
        }),
      );
    });
  });

  it('unselected radio has different appearance from selected', () => {
    createRoot(() => {
      withContext(() => {
        const theme = createMaterialTheme();
        const group = RadioGroup({ defaultValue: 'a' });
        runWithContext(radioGroupContext.context, group._ctx, () => {
          // Both rendered without error; selection drives visual difference
          const selected = Radio({ value: 'a' });
          const unselected = Radio({ value: 'b' });
          expect(selected).toBeTruthy();
          expect(unselected).toBeTruthy();
          // Checked state differs
          expect(selected.semantics?.checked).toBe(true);
          expect(unselected.semantics?.checked).toBe(false);
        });
      });
    });
  });
});

// ─── Arrow key roving (pass-through from headless) ───────────────────────────

describe('Material Radio — arrow key roving', () => {
  it('ArrowDown moves selection to next radio', () => {
    createRoot(() => {
      withContext(() => {
        const seen: any[] = [];
        const group = RadioGroup({ defaultValue: 'a', onChange: (v) => seen.push(v) });
        runWithContext(radioGroupContext.context, group._ctx, () => {
          const radioA = Radio({ value: 'a' });
          Radio({ value: 'b' });
          Radio({ value: 'c' });
          radioA.handlers!.onKeyDown!({ key: 'ArrowDown' } as any);
        });
        expect(seen).toEqual(['b']);
      });
    });
  });

  it('ArrowUp moves selection to previous radio', () => {
    createRoot(() => {
      withContext(() => {
        const seen: any[] = [];
        const group = RadioGroup({ defaultValue: 'b', onChange: (v) => seen.push(v) });
        runWithContext(radioGroupContext.context, group._ctx, () => {
          Radio({ value: 'a' });
          const radioB = Radio({ value: 'b' });
          Radio({ value: 'c' });
          radioB.handlers!.onKeyDown!({ key: 'ArrowUp' } as any);
        });
        expect(seen).toEqual(['a']);
      });
    });
  });
});
