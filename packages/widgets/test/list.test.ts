import { describe, it, expect, vi } from 'vitest';
import { createRoot, runWithContext } from '@cairn/reactivity';
import { Box, Column, Text } from '@cairn/primitives';
import { List, listContext } from '../src/list';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeChild() {
  return { layout: {} as any, children: [], handlers: {} } as any;
}

// ---------------------------------------------------------------------------
// List — roles
// ---------------------------------------------------------------------------

describe('List — roles', () => {
  it('List has role "list"', () => {
    createRoot(() => {
      const list = List({ children: () => Box({}) });
      expect(list.semantics).toBeDefined();
      expect(list.semantics!.role).toBe('list');
    });
  });

  it('List.Item has role "listitem"', () => {
    createRoot(() => {
      const list = List({ children: () => Box({}) });
      runWithContext(listContext.context, list._ctx, () => {
        const item = List.Item({ children: makeChild() });
        expect(item.semantics).toBeDefined();
        expect(item.semantics!.role).toBe('listitem');
      });
    });
  });
});

// ---------------------------------------------------------------------------
// List — N items → N listitems
// ---------------------------------------------------------------------------

describe('List — item count', () => {
  it('renders N items inside the list context', () => {
    createRoot(() => {
      const roles: string[] = [];
      const list = List({
        children: () => {
          const i1 = List.Item({ children: Text({ children: 'One' }) });
          const i2 = List.Item({ children: Text({ children: 'Two' }) });
          const i3 = List.Item({ children: Text({ children: 'Three' }) });
          roles.push(i1.semantics!.role!, i2.semantics!.role!, i3.semantics!.role!);
          return Column({ children: [i1, i2, i3] });
        },
      });
      expect(roles).toEqual(['listitem', 'listitem', 'listitem']);
    });
  });
});

// ---------------------------------------------------------------------------
// List.Item — string child wrapping
// ---------------------------------------------------------------------------

describe('List.Item — string children', () => {
  it('accepts a string child without throwing', () => {
    createRoot(() => {
      const list = List({ children: () => Box({}) });
      runWithContext(listContext.context, list._ctx, () => {
        expect(() => List.Item({ children: 'Hello' })).not.toThrow();
      });
    });
  });

  it('exposes string as semantics.label', () => {
    createRoot(() => {
      const list = List({ children: () => Box({}) });
      runWithContext(listContext.context, list._ctx, () => {
        const item = List.Item({ children: 'My label' });
        expect(item.semantics!.label).toBe('My label');
      });
    });
  });
});

// ---------------------------------------------------------------------------
// List.Item — leading / trailing slots
// ---------------------------------------------------------------------------

describe('List.Item — slots', () => {
  it('renders with a leading slot without throwing', () => {
    createRoot(() => {
      const list = List({ children: () => Box({}) });
      runWithContext(listContext.context, list._ctx, () => {
        expect(() =>
          List.Item({ children: makeChild(), leading: makeChild() }),
        ).not.toThrow();
      });
    });
  });

  it('renders with a trailing slot without throwing', () => {
    createRoot(() => {
      const list = List({ children: () => Box({}) });
      runWithContext(listContext.context, list._ctx, () => {
        expect(() =>
          List.Item({ children: makeChild(), trailing: makeChild() }),
        ).not.toThrow();
      });
    });
  });

  it('renders with both leading and trailing slots', () => {
    createRoot(() => {
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
    });
  });
});

// ---------------------------------------------------------------------------
// List.Item — onClick / clickable
// ---------------------------------------------------------------------------

describe('List.Item — onClick', () => {
  it('item with onClick has focusable=true', () => {
    createRoot(() => {
      const list = List({ children: () => Box({}) });
      runWithContext(listContext.context, list._ctx, () => {
        const item = List.Item({ children: makeChild(), onClick: () => {} });
        expect(item.focusable).toBe(true);
      });
    });
  });

  it('item without onClick is not focusable', () => {
    createRoot(() => {
      const list = List({ children: () => Box({}) });
      runWithContext(listContext.context, list._ctx, () => {
        const item = List.Item({ children: makeChild() });
        expect(item.focusable).toBeFalsy();
      });
    });
  });

  it('fires onClick via semantics.onActivate', () => {
    createRoot(() => {
      let activated = 0;
      const list = List({ children: () => Box({}) });
      runWithContext(listContext.context, list._ctx, () => {
        const item = List.Item({ children: makeChild(), onClick: () => activated++ });
        item.semantics!.onActivate!();
        expect(activated).toBe(1);
      });
    });
  });

  it('fires onClick via handlers.onClick', () => {
    createRoot(() => {
      let clicked = 0;
      const list = List({ children: () => Box({}) });
      runWithContext(listContext.context, list._ctx, () => {
        const item = List.Item({ children: makeChild(), onClick: () => clicked++ });
        item.handlers!.onClick!({} as any);
        expect(clicked).toBe(1);
      });
    });
  });

  it('fires onClick via Enter key', () => {
    createRoot(() => {
      let clicked = 0;
      const list = List({ children: () => Box({}) });
      runWithContext(listContext.context, list._ctx, () => {
        const item = List.Item({ children: makeChild(), onClick: () => clicked++ });
        item.handlers!.onKeyDown!({ key: 'Enter' } as any);
        expect(clicked).toBe(1);
      });
    });
  });

  it('fires onClick via Space key (on keyup)', () => {
    createRoot(() => {
      let clicked = 0;
      const list = List({ children: () => Box({}) });
      runWithContext(listContext.context, list._ctx, () => {
        const item = List.Item({ children: makeChild(), onClick: () => clicked++ });
        item.handlers!.onKeyUp!({ key: ' ' } as any);
        expect(clicked).toBe(1);
      });
    });
  });
});

// ---------------------------------------------------------------------------
// List.Item — disabled
// ---------------------------------------------------------------------------

describe('List.Item — disabled', () => {
  it('disabled item does not fire onClick via handlers.onClick', () => {
    createRoot(() => {
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
    });
  });

  it('disabled item does not fire onClick via Enter key', () => {
    createRoot(() => {
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
    });
  });

  it('disabled item semantics reflects disabled state', () => {
    createRoot(() => {
      const list = List({ children: () => Box({}) });
      runWithContext(listContext.context, list._ctx, () => {
        const item = List.Item({
          children: makeChild(),
          onClick: () => {},
          disabled: true,
        });
        expect(item.semantics!.disabled).toBe(true);
      });
    });
  });
});

// ---------------------------------------------------------------------------
// List — ordered prop
// ---------------------------------------------------------------------------

describe('List — ordered prop', () => {
  it('accepts ordered=true without throwing', () => {
    createRoot(() => {
      expect(() =>
        List({ ordered: true, children: () => Box({}) }),
      ).not.toThrow();
    });
  });

  it('accepts ordered=false without throwing', () => {
    createRoot(() => {
      expect(() =>
        List({ ordered: false, children: () => Box({}) }),
      ).not.toThrow();
    });
  });
});

// ---------------------------------------------------------------------------
// List — style override (layer 2)
// ---------------------------------------------------------------------------

describe('List — style override', () => {
  it('accepts a style prop without throwing', () => {
    createRoot(() => {
      expect(() =>
        List({ style: { backgroundColor: '#f0f0f0' }, children: () => Box({}) }),
      ).not.toThrow();
    });
  });
});

// ---------------------------------------------------------------------------
// List.Item — style override
// ---------------------------------------------------------------------------

describe('List.Item — style override', () => {
  it('accepts a style prop without throwing', () => {
    createRoot(() => {
      const list = List({ children: () => Box({}) });
      runWithContext(listContext.context, list._ctx, () => {
        expect(() =>
          List.Item({ children: makeChild(), style: { backgroundColor: '#eeeeee' } }),
        ).not.toThrow();
      });
    });
  });
});

// ---------------------------------------------------------------------------
// List — LayoutChildProps passthrough
// ---------------------------------------------------------------------------

describe('List — LayoutChildProps', () => {
  it('accepts flex/alignSelf without throwing', () => {
    createRoot(() => {
      expect(() =>
        List({ flex: 1, alignSelf: 'center', children: () => Box({}) }),
      ).not.toThrow();
    });
  });
});
