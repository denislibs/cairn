import { describe, it, expect } from 'vitest';
import { createRoot, runWithContext } from '@cairn/reactivity';
import { Box, Text } from '@cairn/primitives';
import { Tabs, tabsContext } from '../src/tabs';

describe('Tabs — roles', () => {
  it('Tabs.List has role tablist', () => {
    createRoot(() => {
      let listSem: any;
      const tabs = Tabs({ defaultValue: 'a', children: () => {
        const list = Tabs.List({ children: () => Box({}) });
        listSem = list.semantics;
        return list;
      }});
      expect(listSem?.role).toBe('tablist');
    });
  });

  it('Tabs.Tab has role tab', () => {
    createRoot(() => {
      const tabs = Tabs({ defaultValue: 'a', children: () => Box({}) });
      runWithContext(tabsContext.context, tabs._ctx, () => {
        const tab = Tabs.Tab({ value: 'a', children: Text({ children: 'A' }) });
        expect(tab.semantics).toBeDefined();
        expect(tab.semantics!.role).toBe('tab');
      });
    });
  });

  it('Tabs.Panel has role tabpanel', () => {
    createRoot(() => {
      const tabs = Tabs({ defaultValue: 'a', children: () => Box({}) });
      runWithContext(tabsContext.context, tabs._ctx, () => {
        const panel = Tabs.Panel({ value: 'a', children: () => Box({}) });
        expect(panel.semantics!.role).toBe('tabpanel');
      });
    });
  });
});

describe('Tabs — selecting', () => {
  it('selected tab has aria-selected=true', () => {
    createRoot(() => {
      const tabs = Tabs({ defaultValue: 'a', children: () => Box({}) });
      runWithContext(tabsContext.context, tabs._ctx, () => {
        const tabA = Tabs.Tab({ value: 'a', children: Text({ children: 'A' }) });
        const tabB = Tabs.Tab({ value: 'b', children: Text({ children: 'B' }) });
        expect(tabA.semantics!.selected).toBe(true);
        expect(tabB.semantics!.selected).toBe(false);
      });
    });
  });

  it('onActivate selects the tab', () => {
    createRoot(() => {
      const seen: any[] = [];
      const tabs = Tabs({ defaultValue: 'a', onChange: (v) => seen.push(v), children: () => Box({}) });
      runWithContext(tabsContext.context, tabs._ctx, () => {
        Tabs.Tab({ value: 'a', children: Text({ children: 'A' }) });
        const tabB = Tabs.Tab({ value: 'b', children: Text({ children: 'B' }) });
        tabB.semantics!.onActivate!();
        expect(seen).toEqual(['b']);
      });
    });
  });

  it('panel only renders when its value matches', () => {
    createRoot(() => {
      const tabs = Tabs({ defaultValue: 'a', children: () => Box({}) });
      runWithContext(tabsContext.context, tabs._ctx, () => {
        const panelA = Tabs.Panel({ value: 'a', children: () => Box({}) });
        const panelB = Tabs.Panel({ value: 'b', children: () => Box({}) });
        expect(panelA.children.length).toBe(1); // shown
        expect(panelB.children.length).toBe(0); // hidden
      });
    });
  });
});

describe('Tabs — roving', () => {
  it('only active tab is focusable', () => {
    createRoot(() => {
      const tabs = Tabs({ defaultValue: 'a', children: () => Box({}) });
      runWithContext(tabsContext.context, tabs._ctx, () => {
        const tabA = Tabs.Tab({ value: 'a', children: Text({ children: 'A' }) });
        const tabB = Tabs.Tab({ value: 'b', children: Text({ children: 'B' }) });
        expect(tabA.semantics!.focusable).toBe(true);
        expect(tabB.semantics!.focusable).toBe(false);
      });
    });
  });

  it('ArrowRight moves active tab and selects on automatic mode', () => {
    createRoot(() => {
      const seen: any[] = [];
      const tabs = Tabs({ defaultValue: 'a', onChange: (v) => seen.push(v), children: () => Box({}) });
      runWithContext(tabsContext.context, tabs._ctx, () => {
        const tabA = Tabs.Tab({ value: 'a', children: Text({ children: 'A' }) });
        const tabB = Tabs.Tab({ value: 'b', children: Text({ children: 'B' }) });
        tabA.semantics!.onKeyDown!('ArrowRight', { shift: false, ctrl: false, alt: false, meta: false });
        expect(seen).toEqual(['b']);
      });
    });
  });

  it('manual mode: ArrowRight moves focus but does not select', () => {
    createRoot(() => {
      const seen: any[] = [];
      const tabs = Tabs({ defaultValue: 'a', activation: 'manual', onChange: (v) => seen.push(v), children: () => Box({}) });
      runWithContext(tabsContext.context, tabs._ctx, () => {
        const tabA = Tabs.Tab({ value: 'a', children: Text({ children: 'A' }) });
        const tabB = Tabs.Tab({ value: 'b', children: Text({ children: 'B' }) });
        tabA.semantics!.onKeyDown!('ArrowRight', { shift: false, ctrl: false, alt: false, meta: false });
        expect(seen).toEqual([]);
      });
    });
  });

  it('Enter selects in manual mode', () => {
    createRoot(() => {
      const seen: any[] = [];
      const tabs = Tabs({ defaultValue: 'a', activation: 'manual', onChange: (v) => seen.push(v), children: () => Box({}) });
      runWithContext(tabsContext.context, tabs._ctx, () => {
        const tabA = Tabs.Tab({ value: 'a', children: Text({ children: 'A' }) });
        const tabB = Tabs.Tab({ value: 'b', children: Text({ children: 'B' }) });
        tabB.semantics!.onKeyDown!('Enter', { shift: false, ctrl: false, alt: false, meta: false });
        expect(seen).toEqual(['b']);
      });
    });
  });
});
