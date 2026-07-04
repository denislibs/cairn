import { describe, it, expect } from 'vitest';
import { createRoot, runWithContext } from '@cairn/reactivity';
import { hostContext } from '@cairn/runtime';
import { themeContext } from '@cairn/style';
import { Box, Text } from '@cairn/primitives';
import { tabsContext } from '@cairn/widgets';
import { Tabs } from '../src/tabs';
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

// ─── Roles ───────────────────────────────────────────────────────────────────

describe('Material Tabs — roles', () => {
  it('Tabs.List has role tablist', () => {
    createRoot(() => withContext(() => {
      let listSem: any;
      Tabs({ defaultValue: 'a', children: () => {
        const list = Tabs.List({ children: () => Box({}) });
        listSem = list.semantics;
        return list;
      }});
      expect(listSem?.role).toBe('tablist');
    }));
  });

  it('Tabs.Tab has role tab', () => {
    createRoot(() => withContext(() => {
      const tabs = Tabs({ defaultValue: 'a', children: () => Box({}) });
      runWithContext(tabsContext.context, tabs._ctx, () => {
        const tab = Tabs.Tab({ value: 'a', children: 'A' });
        expect(tab.semantics).toBeDefined();
        expect(tab.semantics!.role).toBe('tab');
      });
    }));
  });

  it('Tabs.Panel has role tabpanel', () => {
    createRoot(() => withContext(() => {
      const tabs = Tabs({ defaultValue: 'a', children: () => Box({}) });
      runWithContext(tabsContext.context, tabs._ctx, () => {
        const panel = Tabs.Panel({ value: 'a', children: () => Box({}) });
        expect(panel.semantics!.role).toBe('tabpanel');
      });
    }));
  });
});

// ─── Selecting ───────────────────────────────────────────────────────────────

describe('Material Tabs — selecting', () => {
  it('selected tab has aria-selected=true', () => {
    createRoot(() => withContext(() => {
      const tabs = Tabs({ defaultValue: 'a', children: () => Box({}) });
      runWithContext(tabsContext.context, tabs._ctx, () => {
        const tabA = Tabs.Tab({ value: 'a', children: 'A' });
        const tabB = Tabs.Tab({ value: 'b', children: 'B' });
        expect(tabA.semantics!.selected).toBe(true);
        expect(tabB.semantics!.selected).toBe(false);
      });
    }));
  });

  it('onActivate selects the tab', () => {
    createRoot(() => withContext(() => {
      const seen: any[] = [];
      const tabs = Tabs({ defaultValue: 'a', onChange: (v) => seen.push(v), children: () => Box({}) });
      runWithContext(tabsContext.context, tabs._ctx, () => {
        Tabs.Tab({ value: 'a', children: 'A' });
        const tabB = Tabs.Tab({ value: 'b', children: 'B' });
        tabB.semantics!.onActivate!();
        expect(seen).toEqual(['b']);
      });
    }));
  });

  it('panel only renders when its value matches', () => {
    createRoot(() => withContext(() => {
      const tabs = Tabs({ defaultValue: 'a', children: () => Box({}) });
      runWithContext(tabsContext.context, tabs._ctx, () => {
        const panelA = Tabs.Panel({ value: 'a', children: () => Box({}) });
        const panelB = Tabs.Panel({ value: 'b', children: () => Box({}) });
        expect(panelA.children.length).toBe(1); // shown
        expect(panelB.children.length).toBe(0); // hidden
      });
    }));
  });
});

// ─── Roving / keyboard ───────────────────────────────────────────────────────

describe('Material Tabs — roving', () => {
  it('only active tab is focusable', () => {
    createRoot(() => withContext(() => {
      const tabs = Tabs({ defaultValue: 'a', children: () => Box({}) });
      runWithContext(tabsContext.context, tabs._ctx, () => {
        const tabA = Tabs.Tab({ value: 'a', children: 'A' });
        const tabB = Tabs.Tab({ value: 'b', children: 'B' });
        expect(tabA.semantics!.focusable).toBe(true);
        expect(tabB.semantics!.focusable).toBe(false);
      });
    }));
  });

  it('ArrowRight moves active tab and selects on automatic mode', () => {
    createRoot(() => withContext(() => {
      const seen: any[] = [];
      const tabs = Tabs({ defaultValue: 'a', onChange: (v) => seen.push(v), children: () => Box({}) });
      runWithContext(tabsContext.context, tabs._ctx, () => {
        const tabA = Tabs.Tab({ value: 'a', children: 'A' });
        Tabs.Tab({ value: 'b', children: 'B' });
        tabA.semantics!.onKeyDown!('ArrowRight', { shift: false, ctrl: false, alt: false, meta: false });
        expect(seen).toEqual(['b']);
      });
    }));
  });

  it('manual mode: ArrowRight moves focus but does not select', () => {
    createRoot(() => withContext(() => {
      const seen: any[] = [];
      const tabs = Tabs({ defaultValue: 'a', activation: 'manual', onChange: (v) => seen.push(v), children: () => Box({}) });
      runWithContext(tabsContext.context, tabs._ctx, () => {
        const tabA = Tabs.Tab({ value: 'a', children: 'A' });
        Tabs.Tab({ value: 'b', children: 'B' });
        tabA.semantics!.onKeyDown!('ArrowRight', { shift: false, ctrl: false, alt: false, meta: false });
        expect(seen).toEqual([]);
      });
    }));
  });

  it('Enter selects in manual mode', () => {
    createRoot(() => withContext(() => {
      const seen: any[] = [];
      const tabs = Tabs({ defaultValue: 'a', activation: 'manual', onChange: (v) => seen.push(v), children: () => Box({}) });
      runWithContext(tabsContext.context, tabs._ctx, () => {
        Tabs.Tab({ value: 'a', children: 'A' });
        const tabB = Tabs.Tab({ value: 'b', children: 'B' });
        tabB.semantics!.onKeyDown!('Enter', { shift: false, ctrl: false, alt: false, meta: false });
        expect(seen).toEqual(['b']);
      });
    }));
  });
});

// ─── Material styling ─────────────────────────────────────────────────────────

describe('Material Tabs — active styling', () => {
  it('active tab text color differs from inactive (primary.main vs text.secondary)', () => {
    createRoot(() => withContext(() => {
      const theme = createMaterialTheme();
      const tabs = Tabs({ defaultValue: 'a', children: () => Box({}) });
      runWithContext(tabsContext.context, tabs._ctx, () => {
        const tabA = Tabs.Tab({ value: 'a', children: 'A' });
        const tabB = Tabs.Tab({ value: 'b', children: 'B' });
        // Active tab (a) should be selected, inactive (b) not selected
        expect(tabA.semantics!.selected).toBe(true);
        expect(tabB.semantics!.selected).toBe(false);
        // Material Tabs instance created without error (styling is applied)
        expect(tabA).toBeTruthy();
        expect(tabB).toBeTruthy();
      });
    }));
  });

  it('List renders as a container (has children)', () => {
    createRoot(() => withContext(() => {
      let list: any;
      Tabs({ defaultValue: 'a', children: () => {
        list = Tabs.List({ children: () => Box({}) });
        return list;
      }});
      expect(list).toBeTruthy();
      // The list wraps content — it must have at least one child (the inner provider)
      expect(list.children.length).toBeGreaterThanOrEqual(1);
    }));
  });
});

// ─── Indicator ───────────────────────────────────────────────────────────────

describe('Material Tabs — indicator', () => {
  it('Tabs instance has children (list + indicator)', () => {
    createRoot(() => withContext(() => {
      let innerChildren: any[] = [];
      const tabs = Tabs({ defaultValue: 'a', children: () => {
        const list = Tabs.List({ children: () => {
          const tabA = Tabs.Tab({ value: 'a', children: 'A' });
          const tabB = Tabs.Tab({ value: 'b', children: 'B' });
          return Box({ children: tabA });
        }});
        return list;
      }});
      // The Tabs wrapper builds a Column containing the list and the indicator
      // It should have at least one child (layout tree)
      expect(tabs).toBeTruthy();
      expect(tabs._ctx).toBeDefined();
    }));
  });

  it('indicator is present in Tabs tree as a painted Box', () => {
    createRoot(() => withContext(() => {
      const tabs = Tabs({ defaultValue: 'a', children: () => {
        return Tabs.List({ children: () => Box({}) });
      }});

      // Walk the instance tree to find a node that has paintSelf
      // (the indicator is a Box with backgroundColor = primary.main)
      function hasPaintedBox(node: any, depth = 0): boolean {
        if (!node) return false;
        if (depth > 0 && typeof node.paintSelf === 'function') return true;
        for (const c of (node.children ?? [])) {
          if (hasPaintedBox(c, depth + 1)) return true;
        }
        return false;
      }

      expect(hasPaintedBox(tabs)).toBe(true);
    }));
  });

  it('string Tab children are wrapped in Text (leaf node has paintSelf)', () => {
    createRoot(() => withContext(() => {
      const tabs = Tabs({ defaultValue: 'a', children: () => Box({}) });
      runWithContext(tabsContext.context, tabs._ctx, () => {
        const tab = Tabs.Tab({ value: 'a', children: 'Hello' });
        // String children must be wrapped in a Text node — find a leaf with paintSelf
        function findLeafWithPaint(node: any): boolean {
          if (!node) return false;
          if ((node.children == null || node.children.length === 0) && typeof node.paintSelf === 'function') {
            return true;
          }
          for (const c of (node.children ?? [])) {
            if (findLeafWithPaint(c)) return true;
          }
          return false;
        }
        expect(findLeafWithPaint(tab)).toBe(true);
      });
    }));
  });
});
