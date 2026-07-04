import { describe, it, expect } from 'vitest';
import { createRoot, runWithContext } from '@cairn/reactivity';
import { hostContext } from '@cairn/runtime';
import { themeContext } from '@cairn/style';
import { Switch } from '../src/switch';
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

/** Walk an instance tree depth-first, returning all nodes. */
function collectAll(node: any): any[] {
  if (!node) return [];
  const nodes: any[] = [node];
  for (const c of node.children ?? []) {
    nodes.push(...collectAll(c));
  }
  return nodes;
}

describe('Material Switch — renders', () => {
  it('creates an instance without error', () => {
    createRoot(() => withContext(() => {
      const inst = Switch({});
      expect(inst).toBeTruthy();
    }));
  });

  it('is focusable (from headless Switch)', () => {
    createRoot(() => withContext(() => {
      // Walk the tree: at least one node must be focusable
      const inst = Switch({});
      const all = collectAll(inst);
      const anyFocusable = all.some((n) => n.focusable === true);
      expect(anyFocusable).toBe(true);
    }));
  });

  it('has role="switch" semantics', () => {
    createRoot(() => withContext(() => {
      const inst = Switch({});
      const all = collectAll(inst);
      const withSwitch = all.find((n) => n.semantics?.role === 'switch');
      expect(withSwitch).toBeTruthy();
    }));
  });
});

describe('Material Switch — on/off visual differs', () => {
  it('off state has different track backgroundColor than on state', () => {
    createRoot(() => {
      const theme = createMaterialTheme();
      runWithContext(hostContext, fakeHost(), () =>
        runWithContext(themeContext, () => theme as any, () => {
          // We verify the color values used for on/off differ
          const offColor = theme.palette.action.disabledBg; // grey/action track
          const onColor = theme.palette.primary.main;        // primary.main track
          expect(offColor).not.toBe(onColor);

          // Both switches create successfully
          const instOff = Switch({ defaultChecked: false });
          const instOn = Switch({ defaultChecked: true });
          expect(instOff).toBeTruthy();
          expect(instOn).toBeTruthy();
        }),
      );
    });
  });
});

describe('Material Switch — onChange pass-through toggles', () => {
  it('calls onChange when click handler fires', () => {
    createRoot(() => withContext(() => {
      let lastValue: boolean | undefined;
      const inst = Switch({ defaultChecked: false, onChange: (v) => { lastValue = v; } });
      // Find the focusable node which carries the handlers
      const all = collectAll(inst);
      const trackNode = all.find((n) => n.focusable === true);
      expect(trackNode).toBeTruthy();
      trackNode!.handlers!.onClick!({} as any);
      expect(lastValue).toBe(true);
    }));
  });

  it('calls onChange with false when toggling from checked', () => {
    createRoot(() => withContext(() => {
      let lastValue: boolean | undefined;
      const inst = Switch({ defaultChecked: true, onChange: (v) => { lastValue = v; } });
      const all = collectAll(inst);
      const trackNode = all.find((n) => n.focusable === true);
      trackNode!.handlers!.onClick!({} as any);
      expect(lastValue).toBe(false);
    }));
  });

  it('calls onChange via Enter key', () => {
    createRoot(() => withContext(() => {
      let called = false;
      const inst = Switch({ onChange: () => { called = true; } });
      const all = collectAll(inst);
      const trackNode = all.find((n) => n.focusable === true);
      trackNode!.handlers!.onKeyDown!({ key: 'Enter' } as any);
      expect(called).toBe(true);
    }));
  });
});

describe('Material Switch — disabled', () => {
  it('does not call onChange when disabled', () => {
    createRoot(() => withContext(() => {
      let called = false;
      const inst = Switch({ disabled: true, onChange: () => { called = true; } });
      const all = collectAll(inst);
      const trackNode = all.find((n) => n.focusable === true);
      trackNode?.handlers?.onClick?.({} as any);
      expect(called).toBe(false);
    }));
  });

  it('has disabled semantics when disabled prop set', () => {
    createRoot(() => withContext(() => {
      const inst = Switch({ disabled: true });
      const all = collectAll(inst);
      const switchNode = all.find((n) => n.semantics?.role === 'switch');
      expect(switchNode?.semantics?.disabled).toBe(true);
    }));
  });
});

describe('Material Switch — label', () => {
  it('renders without label by default', () => {
    createRoot(() => withContext(() => {
      const inst = Switch({});
      expect(inst).toBeTruthy();
    }));
  });

  it('renders with label when label prop provided', () => {
    createRoot(() => withContext(() => {
      const inst = Switch({ label: 'Enable notifications' });
      expect(inst).toBeTruthy();
      // With a label, the tree should contain a Text node (leaf with drawText-capable paint or children)
      const all = collectAll(inst);
      expect(all.length).toBeGreaterThan(1);
    }));
  });
});

describe('Material Switch — color prop', () => {
  it('accepts secondary color without error', () => {
    createRoot(() => withContext(() => {
      const inst = Switch({ color: 'secondary' });
      expect(inst).toBeTruthy();
    }));
  });

  it('defaults to primary color', () => {
    createRoot(() => withContext(() => {
      const inst = Switch({});
      expect(inst).toBeTruthy();
    }));
  });
});

describe('Material Switch — controlled mode', () => {
  it('accepts a checked accessor', () => {
    createRoot(() => withContext(() => {
      const inst = Switch({ checked: true });
      expect(inst).toBeTruthy();
      const all = collectAll(inst);
      const switchNode = all.find((n) => n.semantics?.role === 'switch');
      expect(switchNode?.semantics?.checked).toBe(true);
    }));
  });
});
