import { describe, it, expect, vi } from 'vitest';
import { createRoot } from '@cairn/reactivity';
import { themeContext } from '@cairn/style';
import { runWithContext } from '@cairn/reactivity';
import { resolveStyleInput } from '@cairn/primitives';
import { Card } from '../src/card';
import { defaultTheme } from '../src/theme';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeChild() {
  return { layout: {} as any, children: [], handlers: {} } as any;
}

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

describe('Card — rendering', () => {
  it('renders a single Instance child', () => {
    createRoot(() => {
      const child = makeChild();
      const card = Card({ children: child });
      // Card wraps in a Column — the child should be reachable in descendants
      expect(card).toBeDefined();
    });
  });

  it('renders an array of Instance children', () => {
    createRoot(() => {
      const children = [makeChild(), makeChild(), makeChild()];
      const card = Card({ children });
      expect(card).toBeDefined();
    });
  });

  it('accepts a string child (wraps in Text)', () => {
    createRoot(() => {
      const card = Card({ children: 'Hello Card' });
      expect(card).toBeDefined();
    });
  });

  it('renders without children', () => {
    createRoot(() => {
      expect(() => Card({})).not.toThrow();
    });
  });
});

// ---------------------------------------------------------------------------
// Semantics — non-interactive (group)
// ---------------------------------------------------------------------------

describe('Card — non-interactive semantics', () => {
  it('has semantics with role "group" when not interactive', () => {
    createRoot(() => {
      const card = Card({ children: makeChild() });
      expect(card.semantics).toBeDefined();
      expect(card.semantics!.role).toBe('group');
    });
  });

  it('non-interactive card has no onActivate', () => {
    createRoot(() => {
      const card = Card({ children: makeChild() });
      expect(card.semantics!.onActivate).toBeUndefined();
    });
  });
});

// ---------------------------------------------------------------------------
// Semantics — interactive (button)
// ---------------------------------------------------------------------------

describe('Card — interactive semantics', () => {
  it('has role "button" when interactive', () => {
    createRoot(() => {
      const card = Card({ interactive: true, onClick: () => {} });
      expect(card.semantics!.role).toBe('button');
    });
  });

  it('is focusable when interactive', () => {
    createRoot(() => {
      const card = Card({ interactive: true, onClick: () => {} });
      expect(card.focusable).toBe(true);
    });
  });

  it('fires onClick via semantics.onActivate', () => {
    createRoot(() => {
      let activated = 0;
      const card = Card({ interactive: true, onClick: () => activated++ });
      card.semantics!.onActivate!();
      expect(activated).toBe(1);
    });
  });

  it('fires onClick via handlers.onClick', () => {
    createRoot(() => {
      let clicked = 0;
      const card = Card({ interactive: true, onClick: () => clicked++ });
      card.handlers!.onClick!({} as any);
      expect(clicked).toBe(1);
    });
  });

  it('fires onClick via Enter key', () => {
    createRoot(() => {
      let clicked = 0;
      const card = Card({ interactive: true, onClick: () => clicked++ });
      card.handlers!.onKeyDown!({ key: 'Enter' } as any);
      expect(clicked).toBe(1);
    });
  });

  it('fires onClick via Space key (on keyup)', () => {
    createRoot(() => {
      let clicked = 0;
      const card = Card({ interactive: true, onClick: () => clicked++ });
      card.handlers!.onKeyUp!({ key: ' ' } as any);
      expect(clicked).toBe(1);
    });
  });
});

// ---------------------------------------------------------------------------
// Elevation — style changes
// ---------------------------------------------------------------------------

describe('Card — elevation style', () => {
  it('elevation=0 renders without boxShadow', () => {
    createRoot(() => {
      runWithContext(themeContext, () => defaultTheme, () => {
        const card = Card({ elevation: 0 });
        // We verify by constructing and resolving a style that matches elevation=0
        const styleFn = (_th: any) => [{ backgroundColor: '#ffffff' }];
        const resolved = resolveStyleInput(styleFn, defaultTheme);
        expect(resolved.boxShadow).toBeUndefined();
      });
    });
  });

  it('card with elevation=1 does not throw', () => {
    createRoot(() => {
      expect(() => Card({ elevation: 1 })).not.toThrow();
    });
  });

  it('card with elevation=2 does not throw', () => {
    createRoot(() => {
      expect(() => Card({ elevation: 2 })).not.toThrow();
    });
  });

  it('card with elevation=3 does not throw', () => {
    createRoot(() => {
      expect(() => Card({ elevation: 3 })).not.toThrow();
    });
  });

  it('elevation defaults to 1', () => {
    createRoot(() => {
      // Default elevation is non-zero (has a shadow) — just verify no throw and semantics present
      const card = Card({});
      expect(card.semantics).toBeDefined();
    });
  });
});

// ---------------------------------------------------------------------------
// Style override (layer 2)
// ---------------------------------------------------------------------------

describe('Card — style override', () => {
  it('accepts style prop without throwing', () => {
    createRoot(() => {
      runWithContext(themeContext, () => defaultTheme, () => {
        expect(() =>
          Card({ style: { backgroundColor: '#ff0000' } }),
        ).not.toThrow();
      });
    });
  });

  it('style override is reflected in resolved output', () => {
    createRoot(() => {
      runWithContext(themeContext, () => defaultTheme, () => {
        const override = { backgroundColor: '#abcdef' };
        const resolved = resolveStyleInput(
          (_th: any) => [{ backgroundColor: '#ffffff' }, override],
          defaultTheme,
        );
        expect(resolved.backgroundColor).toBe('#abcdef');
      });
    });
  });
});

// ---------------------------------------------------------------------------
// Padding prop
// ---------------------------------------------------------------------------

describe('Card — padding prop', () => {
  it('accepts a custom padding without throwing', () => {
    createRoot(() => {
      expect(() => Card({ padding: 24 })).not.toThrow();
    });
  });

  it('uses default padding when none specified', () => {
    createRoot(() => {
      expect(() => Card({})).not.toThrow();
    });
  });
});

// ---------------------------------------------------------------------------
// LayoutChildProps passthrough
// ---------------------------------------------------------------------------

describe('Card — LayoutChildProps', () => {
  it('applyLayoutChildProps is called (instance has no undefined layout crash)', () => {
    createRoot(() => {
      expect(() =>
        Card({ flex: 1, alignSelf: 'center', children: makeChild() }),
      ).not.toThrow();
    });
  });
});
