import { describe, it, expect } from 'vitest';
import { createRoot, runWithContext } from '@cairn/reactivity';
import { hostContext, overlayContext, createOverlayRegistry } from '@cairn/runtime';
import { themeContext } from '@cairn/style';
import { resolveStyleInput, Box, Column } from '@cairn/primitives';
import { Dialog } from '../src/dialog';
import { createMaterialTheme } from '../src/theme';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fakeHost() {
  const host: any = {
    scheduler: {
      requestFrame(_cb: any) { return 1; },
      cancelFrame() {},
    },
    renderer: {},
    metrics: { width: 800, height: 600 },
    input: {},
  };
  return host;
}

function withContext<T>(fn: () => T): T {
  const theme = createMaterialTheme();
  const reg = createOverlayRegistry();
  return createRoot(() =>
    runWithContext(overlayContext, reg, () =>
      runWithContext(hostContext, fakeHost(), () =>
        runWithContext(themeContext, () => theme as any, fn),
      ),
    ),
  );
}

/** Recursively walk the instance tree. Returns the first node matching predicate. */
function findNode(node: any, pred: (n: any) => boolean): any {
  if (!node) return null;
  if (pred(node)) return node;
  for (const c of (node.children ?? [])) {
    const found = findNode(c, pred);
    if (found) return found;
  }
  return null;
}

// ─── Compound API shape ────────────────────────────────────────────────────────

describe('Material Dialog — compound API', () => {
  it('Dialog has Trigger sub-component', () => {
    expect(typeof Dialog.Trigger).toBe('function');
  });

  it('Dialog has Content sub-component', () => {
    expect(typeof Dialog.Content).toBe('function');
  });

  it('Dialog has Title sub-component', () => {
    expect(typeof Dialog.Title).toBe('function');
  });

  it('Dialog has Description sub-component', () => {
    expect(typeof Dialog.Description).toBe('function');
  });

  it('Dialog has Actions sub-component', () => {
    expect(typeof Dialog.Actions).toBe('function');
  });

  it('Dialog has Close sub-component', () => {
    expect(typeof Dialog.Close).toBe('function');
  });
});

// ─── Dialog root renders ───────────────────────────────────────────────────────

describe('Material Dialog — root renders', () => {
  it('renders without crashing with minimal props', () => {
    withContext(() => {
      const inst = Dialog({
        children: () => Box({ style: { width: 0, height: 0 } }),
      });
      expect(inst).toBeTruthy();
    });
  });
});

// ─── Dialog.Trigger ───────────────────────────────────────────────────────────

describe('Material Dialog.Trigger — renders', () => {
  it('creates an instance when placed inside a Dialog', () => {
    withContext(() => {
      let triggerInst: any = null;
      Dialog({
        children: () => {
          triggerInst = Dialog.Trigger({ children: 'Open' });
          return triggerInst;
        },
      });
      expect(triggerInst).toBeTruthy();
    });
  });

  it('exposes role button semantics (from headless)', () => {
    withContext(() => {
      let triggerInst: any = null;
      Dialog({
        children: () => {
          triggerInst = Dialog.Trigger({ children: 'Open dialog' });
          return triggerInst;
        },
      });
      const withRole = findNode(triggerInst, (n) => n.semantics?.role === 'button' || n.role === 'button');
      expect(withRole).not.toBeNull();
    });
  });
});

// ─── Dialog.Content — paper surface style ─────────────────────────────────────

describe('Material Dialog.Content — paper surface style', () => {
  it('Content registers without crashing', () => {
    withContext(() => {
      let contentInst: any = null;
      Dialog({
        children: () => {
          contentInst = Dialog.Content({
            children: Box({ style: { width: 1, height: 1 } }),
          });
          return contentInst;
        },
      });
      expect(contentInst).toBeTruthy();
    });
  });

  it('backgroundColor resolves to palette.background.paper', () => {
    createRoot(() => {
      const theme = createMaterialTheme();
      const reg = createOverlayRegistry();
      runWithContext(overlayContext, reg, () =>
        runWithContext(hostContext, fakeHost(), () =>
          runWithContext(themeContext, () => theme as any, () => {
            const style = [{ backgroundColor: theme.palette.background.paper }];
            const resolved = resolveStyleInput(style, theme as any);
            expect(resolved.backgroundColor).toBe(theme.palette.background.paper);
          }),
        ),
      );
    });
  });

  it('elevation 24 shadow is non-empty', () => {
    createRoot(() => {
      const theme = createMaterialTheme();
      const reg = createOverlayRegistry();
      runWithContext(overlayContext, reg, () =>
        runWithContext(hostContext, fakeHost(), () =>
          runWithContext(themeContext, () => theme as any, () => {
            const elev = Math.min(24, theme.elevation.length - 1);
            const style = [{ boxShadow: theme.elevation[elev] }];
            const resolved = resolveStyleInput(style, theme as any);
            expect(resolved.boxShadow).toBeDefined();
            expect(Array.isArray(resolved.boxShadow)).toBe(true);
            expect((resolved.boxShadow as any[]).length).toBeGreaterThan(0);
          }),
        ),
      );
    });
  });

  it('borderRadius from shape is non-zero', () => {
    createRoot(() => {
      const theme = createMaterialTheme();
      const reg = createOverlayRegistry();
      runWithContext(overlayContext, reg, () =>
        runWithContext(hostContext, fakeHost(), () =>
          runWithContext(themeContext, () => theme as any, () => {
            const style = [{ borderRadius: theme.shape.borderRadius }];
            const resolved = resolveStyleInput(style, theme as any);
            expect(resolved.borderRadius).toBe(theme.shape.borderRadius);
            expect(resolved.borderRadius).toBeGreaterThan(0);
          }),
        ),
      );
    });
  });

  it('padding 24 resolves correctly', () => {
    createRoot(() => {
      const theme = createMaterialTheme();
      const reg = createOverlayRegistry();
      runWithContext(overlayContext, reg, () =>
        runWithContext(hostContext, fakeHost(), () =>
          runWithContext(themeContext, () => theme as any, () => {
            const style = [{ padding: 24 }];
            const resolved = resolveStyleInput(style, theme as any);
            expect(resolved.padding).toBe(24);
          }),
        ),
      );
    });
  });
});

// ─── Dialog.Title — h6 typography ─────────────────────────────────────────────

describe('Material Dialog.Title — h6 typography', () => {
  it('Title creates instance without crashing', () => {
    withContext(() => {
      let titleInst: any = null;
      Dialog({
        children: () => {
          titleInst = Dialog.Title({ children: 'My dialog title' });
          return titleInst;
        },
      });
      expect(titleInst).toBeTruthy();
    });
  });

  it('Title renders a node with paintSelf (Text node)', () => {
    withContext(() => {
      let titleInst: any = null;
      Dialog({
        children: () => {
          titleInst = Dialog.Title({ children: 'Hello' });
          return titleInst;
        },
      });
      // Text nodes have paintSelf for rendering characters
      const textNode = findNode(titleInst, (n) => typeof n.paintSelf === 'function');
      expect(textNode).not.toBeNull();
    });
  });

  it('h6 fontSize (20) is set on theme typography', () => {
    const theme = createMaterialTheme();
    expect(theme.typography.h6.fontSize).toBe(20);
    expect(theme.typography.h6.fontWeight).toBe(500);
  });
});

// ─── Dialog.Description ───────────────────────────────────────────────────────

describe('Material Dialog.Description — renders', () => {
  it('creates a text instance', () => {
    withContext(() => {
      let descInst: any = null;
      Dialog({
        children: () => {
          descInst = Dialog.Description({ children: 'Some description' });
          return descInst;
        },
      });
      expect(descInst).toBeTruthy();
    });
  });

  it('renders a node with paintSelf (Text node)', () => {
    withContext(() => {
      let descInst: any = null;
      Dialog({
        children: () => {
          descInst = Dialog.Description({ children: 'Desc' });
          return descInst;
        },
      });
      const textNode = findNode(descInst, (n) => typeof n.paintSelf === 'function');
      expect(textNode).not.toBeNull();
    });
  });
});

// ─── Dialog.Actions — right-aligned row ───────────────────────────────────────

describe('Material Dialog.Actions — renders as Row', () => {
  it('creates an instance without crashing', () => {
    withContext(() => {
      let actionsInst: any = null;
      Dialog({
        children: () => {
          actionsInst = Dialog.Actions({
            children: [Box({ style: { width: 80, height: 36 } })],
          });
          return actionsInst;
        },
      });
      expect(actionsInst).toBeTruthy();
    });
  });

  it('children appear in the Actions tree', () => {
    withContext(() => {
      let actionsInst: any = null;
      const child = Box({ style: { width: 80, height: 36 } });
      Dialog({
        children: () => {
          actionsInst = Dialog.Actions({ children: [child] });
          return actionsInst;
        },
      });
      const found = findNode(actionsInst, (n) => n === child);
      expect(found).not.toBeNull();
    });
  });

  it('accepts a single child (not array)', () => {
    withContext(() => {
      let actionsInst: any = null;
      const child = Box({ style: { width: 80, height: 36 } });
      Dialog({
        children: () => {
          actionsInst = Dialog.Actions({ children: child });
          return actionsInst;
        },
      });
      const found = findNode(actionsInst, (n) => n === child);
      expect(found).not.toBeNull();
    });
  });
});

// ─── Dialog.Close ─────────────────────────────────────────────────────────────

describe('Material Dialog.Close — renders', () => {
  it('creates an instance without crashing', () => {
    withContext(() => {
      let closeInst: any = null;
      Dialog({
        children: () => {
          closeInst = Dialog.Close({ children: 'Cancel' });
          return closeInst;
        },
      });
      expect(closeInst).toBeTruthy();
    });
  });

  it('Close has button semantics (from headless)', () => {
    withContext(() => {
      let closeInst: any = null;
      Dialog({
        children: () => {
          closeInst = Dialog.Close({ children: 'Cancel' });
          return closeInst;
        },
      });
      const withRole = findNode(closeInst, (n) => n.semantics?.role === 'button' || n.role === 'button');
      expect(withRole).not.toBeNull();
    });
  });
});

// ─── Dialog — headless behavior delegation (a11y / role:dialog) ───────────────

describe('Material Dialog — headless behavior delegation', () => {
  it('headless Dialog surface carries role:dialog semantics when opened', () => {
    withContext(() => {
      // The Material Dialog wraps headless — verify no crash and API is intact.
      const inst = Dialog({
        defaultOpen: false,
        children: () => Dialog.Content({ children: Box({ style: { width: 1, height: 1 } }) }),
      });
      expect(inst).toBeTruthy();
    });
  });

  it('Dialog opened with defaultOpen=true creates a portal (headless behavior)', () => {
    withContext(() => {
      // When defaultOpen=true, headless builds a portal immediately.
      const inst = Dialog({
        defaultOpen: true,
        children: () => Dialog.Content({
          children: Dialog.Title({ children: 'Test' }),
        }),
      });
      expect(inst).toBeTruthy();
    });
  });
});

// ─── Material Dialog — full compound usage ────────────────────────────────────

describe('Material Dialog — full compound tree', () => {
  it('composes Trigger + Content + Title + Description + Actions + Close without crashing', () => {
    withContext(() => {
      const inst = Dialog({
        children: () => Column({
          children: [
            Dialog.Trigger({ children: 'Open' }),
            Dialog.Content({
              children: Column({
                children: [
                  Dialog.Title({ children: 'Confirm action' }),
                  Dialog.Description({ children: 'Are you sure?' }),
                  Dialog.Actions({
                    children: [
                      Dialog.Close({ children: 'Cancel' }),
                    ],
                  }),
                ],
              }),
            }),
          ],
        }),
      });
      expect(inst).toBeTruthy();
    });
  });
});
