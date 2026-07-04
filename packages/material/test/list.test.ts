import { describe, it, expect, vi } from 'vitest';
import { createRoot, runWithContext } from '@cairn/reactivity';
import { hostContext } from '@cairn/runtime';
import { themeContext } from '@cairn/style';
import { Box, Column, Text } from '@cairn/primitives';
import { List } from '../src/list';
import { listContext } from '@cairn/widgets';
import { createMaterialTheme } from '../src/theme';

// ---------------------------------------------------------------------------
// Test context helpers
// ---------------------------------------------------------------------------

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

function makeChild() {
  return { layout: {} as any, children: [], handlers: {} } as any;
}

// ---------------------------------------------------------------------------
// List — renders + roles (delegated from headless)
// ---------------------------------------------------------------------------

describe('Material List — renders', () => {
  it('creates an instance without errors', () => {
    createRoot(() => withContext(() => {
      const inst = List({ children: () => Box({}) });
      expect(inst).toBeTruthy();
    }));
  });

  it('has role "list" (from headless)', () => {
    createRoot(() => withContext(() => {
      const inst = List({ children: () => Box({}) });
      expect(inst.semantics?.role).toBe('list');
    }));
  });

  it('accepts dense prop without throwing', () => {
    createRoot(() => withContext(() => {
      expect(() => List({ dense: true, children: () => Box({}) })).not.toThrow();
    }));
  });

  it('accepts style prop without throwing', () => {
    createRoot(() => withContext(() => {
      expect(() =>
        List({ style: { backgroundColor: '#f5f5f5' }, children: () => Box({}) }),
      ).not.toThrow();
    }));
  });

  it('accepts flex/alignSelf (LayoutChildProps) without throwing', () => {
    createRoot(() => withContext(() => {
      expect(() =>
        List({ flex: 1, alignSelf: 'center', children: () => Box({}) }),
      ).not.toThrow();
    }));
  });
});

// ---------------------------------------------------------------------------
// List.Item — compound attachment
// ---------------------------------------------------------------------------

describe('Material List.Item — compound', () => {
  it('List.Item is defined on the List function', () => {
    expect(typeof List.Item).toBe('function');
  });
});

// ---------------------------------------------------------------------------
// List.Item — renders + roles
// ---------------------------------------------------------------------------

describe('Material List.Item — renders', () => {
  it('creates an instance without errors', () => {
    createRoot(() => withContext(() => {
      const list = List({ children: () => Box({}) });
      runWithContext(listContext.context, list._ctx, () => {
        expect(() => List.Item({ children: makeChild() })).not.toThrow();
      });
    }));
  });

  it('has role "listitem" (from headless)', () => {
    createRoot(() => withContext(() => {
      const list = List({ children: () => Box({}) });
      runWithContext(listContext.context, list._ctx, () => {
        const item = List.Item({ children: makeChild() });
        expect(item.semantics?.role).toBe('listitem');
      });
    }));
  });

  it('accepts string children without throwing', () => {
    createRoot(() => withContext(() => {
      const list = List({ children: () => Box({}) });
      runWithContext(listContext.context, list._ctx, () => {
        expect(() => List.Item({ children: 'Hello list item' })).not.toThrow();
      });
    }));
  });

  it('string child exposed as semantics.label', () => {
    createRoot(() => withContext(() => {
      const list = List({ children: () => Box({}) });
      runWithContext(listContext.context, list._ctx, () => {
        const item = List.Item({ children: 'My label' });
        expect(item.semantics?.label).toBe('My label');
      });
    }));
  });

  it('accepts style prop without throwing', () => {
    createRoot(() => withContext(() => {
      const list = List({ children: () => Box({}) });
      runWithContext(listContext.context, list._ctx, () => {
        expect(() =>
          List.Item({ children: makeChild(), style: { backgroundColor: '#eeeeee' } }),
        ).not.toThrow();
      });
    }));
  });
});

// ---------------------------------------------------------------------------
// List.Item — min-height (dense vs normal)
// ---------------------------------------------------------------------------

describe('Material List.Item — min-height styling', () => {
  it('normal item renders (min-height 48 logic present) without throwing', () => {
    createRoot(() => withContext(() => {
      const list = List({ children: () => Box({}) });
      runWithContext(listContext.context, list._ctx, () => {
        expect(() => List.Item({ children: makeChild() })).not.toThrow();
      });
    }));
  });

  it('dense List.Item renders without throwing', () => {
    createRoot(() => withContext(() => {
      const list = List({ dense: true, children: () => Box({}) });
      runWithContext(listContext.context, list._ctx, () => {
        expect(() => List.Item({ children: makeChild(), dense: true })).not.toThrow();
      });
    }));
  });
});

// ---------------------------------------------------------------------------
// List.Item — leading / trailing slots
// ---------------------------------------------------------------------------

describe('Material List.Item — slots', () => {
  it('renders with a leading slot without throwing', () => {
    createRoot(() => withContext(() => {
      const list = List({ children: () => Box({}) });
      runWithContext(listContext.context, list._ctx, () => {
        expect(() =>
          List.Item({ children: makeChild(), leading: makeChild() }),
        ).not.toThrow();
      });
    }));
  });

  it('renders with a trailing slot without throwing', () => {
    createRoot(() => withContext(() => {
      const list = List({ children: () => Box({}) });
      runWithContext(listContext.context, list._ctx, () => {
        expect(() =>
          List.Item({ children: makeChild(), trailing: makeChild() }),
        ).not.toThrow();
      });
    }));
  });

  it('renders with both leading and trailing slots', () => {
    createRoot(() => withContext(() => {
      const list = List({ children: () => Box({}) });
      runWithContext(listContext.context, list._ctx, () => {
        expect(() =>
          List.Item({
            children: makeChild(),
            leading: makeChild(),
            trailing: makeChild(),
          }),
        ).not.toThrow();
      });
    }));
  });
});

// ---------------------------------------------------------------------------
// List.Item — selected state
// ---------------------------------------------------------------------------

describe('Material List.Item — selected', () => {
  it('selected item renders without throwing', () => {
    createRoot(() => withContext(() => {
      const list = List({ children: () => Box({}) });
      runWithContext(listContext.context, list._ctx, () => {
        expect(() =>
          List.Item({ children: makeChild(), selected: true }),
        ).not.toThrow();
      });
    }));
  });

  it('unselected item renders without throwing', () => {
    createRoot(() => withContext(() => {
      const list = List({ children: () => Box({}) });
      runWithContext(listContext.context, list._ctx, () => {
        expect(() =>
          List.Item({ children: makeChild(), selected: false }),
        ).not.toThrow();
      });
    }));
  });
});

// ---------------------------------------------------------------------------
// List.Item — onClick / focusable / keyboard
// ---------------------------------------------------------------------------

describe('Material List.Item — onClick', () => {
  it('item with onClick has focusable=true', () => {
    createRoot(() => withContext(() => {
      const list = List({ children: () => Box({}) });
      runWithContext(listContext.context, list._ctx, () => {
        const item = List.Item({ children: makeChild(), onClick: () => {} });
        expect(item.focusable).toBe(true);
      });
    }));
  });

  it('item without onClick is not focusable', () => {
    createRoot(() => withContext(() => {
      const list = List({ children: () => Box({}) });
      runWithContext(listContext.context, list._ctx, () => {
        const item = List.Item({ children: makeChild() });
        expect(item.focusable).toBeFalsy();
      });
    }));
  });

  it('fires onClick via handlers.onClick', () => {
    createRoot(() => withContext(() => {
      let clicked = 0;
      const list = List({ children: () => Box({}) });
      runWithContext(listContext.context, list._ctx, () => {
        const item = List.Item({ children: makeChild(), onClick: () => clicked++ });
        item.handlers!.onClick!({} as any);
        expect(clicked).toBe(1);
      });
    }));
  });

  it('fires onClick via semantics.onActivate', () => {
    createRoot(() => withContext(() => {
      let activated = 0;
      const list = List({ children: () => Box({}) });
      runWithContext(listContext.context, list._ctx, () => {
        const item = List.Item({ children: makeChild(), onClick: () => activated++ });
        item.semantics!.onActivate!();
        expect(activated).toBe(1);
      });
    }));
  });

  it('fires onClick via Enter key', () => {
    createRoot(() => withContext(() => {
      let clicked = 0;
      const list = List({ children: () => Box({}) });
      runWithContext(listContext.context, list._ctx, () => {
        const item = List.Item({ children: makeChild(), onClick: () => clicked++ });
        item.handlers!.onKeyDown!({ key: 'Enter' } as any);
        expect(clicked).toBe(1);
      });
    }));
  });

  it('fires onClick via Space key (onKeyUp)', () => {
    createRoot(() => withContext(() => {
      let clicked = 0;
      const list = List({ children: () => Box({}) });
      runWithContext(listContext.context, list._ctx, () => {
        const item = List.Item({ children: makeChild(), onClick: () => clicked++ });
        item.handlers!.onKeyUp!({ key: ' ' } as any);
        expect(clicked).toBe(1);
      });
    }));
  });
});

// ---------------------------------------------------------------------------
// List.Item — disabled
// ---------------------------------------------------------------------------

describe('Material List.Item — disabled', () => {
  it('disabled item does not fire onClick via handlers.onClick', () => {
    createRoot(() => withContext(() => {
      let clicked = 0;
      const list = List({ children: () => Box({}) });
      runWithContext(listContext.context, list._ctx, () => {
        const item = List.Item({
          children: makeChild(),
          onClick: () => clicked++,
          disabled: true,
        });
        item.handlers!.onClick!({} as any);
        expect(clicked).toBe(0);
      });
    }));
  });

  it('disabled item does not fire onClick via Enter key', () => {
    createRoot(() => withContext(() => {
      let clicked = 0;
      const list = List({ children: () => Box({}) });
      runWithContext(listContext.context, list._ctx, () => {
        const item = List.Item({
          children: makeChild(),
          onClick: () => clicked++,
          disabled: true,
        });
        item.handlers!.onKeyDown!({ key: 'Enter' } as any);
        expect(clicked).toBe(0);
      });
    }));
  });

  it('disabled item semantics reflects disabled state', () => {
    createRoot(() => withContext(() => {
      const list = List({ children: () => Box({}) });
      runWithContext(listContext.context, list._ctx, () => {
        const item = List.Item({
          children: makeChild(),
          onClick: () => {},
          disabled: true,
        });
        expect(item.semantics?.disabled).toBe(true);
      });
    }));
  });
});

// ---------------------------------------------------------------------------
// List — N items rendered together
// ---------------------------------------------------------------------------

describe('Material List — item count', () => {
  it('renders N items, each with listitem role', () => {
    createRoot(() => withContext(() => {
      const roles: string[] = [];
      List({
        children: () => {
          const i1 = List.Item({ children: Text({ children: 'One' }) });
          const i2 = List.Item({ children: Text({ children: 'Two' }) });
          const i3 = List.Item({ children: Text({ children: 'Three' }) });
          roles.push(i1.semantics!.role!, i2.semantics!.role!, i3.semantics!.role!);
          return Column({ children: [i1, i2, i3] });
        },
      });
      expect(roles).toEqual(['listitem', 'listitem', 'listitem']);
    }));
  });
});

// ---------------------------------------------------------------------------
// Material List — selected bg via action.selected color value
// ---------------------------------------------------------------------------

describe('Material List.Item — selected styling color value', () => {
  it('action.selected color is a non-empty string', () => {
    createRoot(() => withContext(() => {
      const theme = createMaterialTheme();
      expect(typeof theme.palette.action.selected).toBe('string');
      expect(theme.palette.action.selected.length).toBeGreaterThan(0);
    }));
  });

  it('action.hover color is a non-empty string', () => {
    createRoot(() => withContext(() => {
      const theme = createMaterialTheme();
      expect(typeof theme.palette.action.hover).toBe('string');
      expect(theme.palette.action.hover.length).toBeGreaterThan(0);
    }));
  });
});
