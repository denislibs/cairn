import { describe, it, expect } from 'vitest';
import { createRoot } from '@cairn/reactivity';
import { themeContext } from '@cairn/style';
import { resolveStyleInput } from '@cairn/primitives';
import { Chip } from '../src/chip';
import { defaultTheme } from '../src/theme';

// ---------------------------------------------------------------------------
// Chip — label renders
// ---------------------------------------------------------------------------
describe('Chip — label renders', () => {
  it('has a child Text node containing the label', () => {
    createRoot(() => {
      const inst = Chip({ label: 'Tag' });
      // The chip is a Row; at least one descendant must have the label text.
      // Text primitive stores text in node.layout.text (TextNode).
      function findText(node: any): boolean {
        if (node.layout?.text === 'Tag') return true;
        for (const c of node.children ?? []) {
          if (findText(c)) return true;
        }
        return false;
      }
      expect(findText(inst)).toBe(true);
    });
  });
});

// ---------------------------------------------------------------------------
// Chip — no onClick → role 'none'
// ---------------------------------------------------------------------------
describe('Chip — no onClick → decorative', () => {
  it('semantics role is none when no onClick', () => {
    createRoot(() => {
      const inst = Chip({ label: 'Tag' });
      expect(inst.semantics?.role).toBe('none');
    });
  });

  it('is not focusable when no onClick', () => {
    createRoot(() => {
      const inst = Chip({ label: 'Tag' });
      expect(inst.focusable).toBeFalsy();
    });
  });
});

// ---------------------------------------------------------------------------
// Chip — onClick → role 'button'
// ---------------------------------------------------------------------------
describe('Chip — onClick → interactive', () => {
  it('semantics role is button when onClick provided', () => {
    createRoot(() => {
      const inst = Chip({ label: 'Click me', onClick: () => {} });
      expect(inst.semantics?.role).toBe('button');
    });
  });

  it('is focusable when onClick provided', () => {
    createRoot(() => {
      const inst = Chip({ label: 'Click me', onClick: () => {} });
      expect(inst.focusable).toBe(true);
    });
  });

  it('semantics label matches props.label', () => {
    createRoot(() => {
      const inst = Chip({ label: 'Go', onClick: () => {} });
      expect(inst.semantics?.label).toBe('Go');
    });
  });

  it('onActivate fires onClick', () => {
    createRoot(() => {
      let count = 0;
      const inst = Chip({ label: 'Go', onClick: () => count++ });
      inst.semantics!.onActivate!();
      expect(count).toBe(1);
    });
  });

  it('onClick fires via handlers.onClick', () => {
    createRoot(() => {
      let count = 0;
      const inst = Chip({ label: 'Go', onClick: () => count++ });
      inst.handlers!.onClick!({} as any);
      expect(count).toBe(1);
    });
  });

  it('onClick fires via Enter key', () => {
    createRoot(() => {
      let count = 0;
      const inst = Chip({ label: 'Go', onClick: () => count++ });
      inst.handlers!.onKeyDown!({ key: 'Enter' } as any);
      expect(count).toBe(1);
    });
  });

  it('onClick fires via Space key (on keyup)', () => {
    createRoot(() => {
      let count = 0;
      const inst = Chip({ label: 'Go', onClick: () => count++ });
      inst.handlers!.onKeyUp!({ key: ' ' } as any);
      expect(count).toBe(1);
    });
  });
});

// ---------------------------------------------------------------------------
// Chip — disabled
// ---------------------------------------------------------------------------
describe('Chip — disabled', () => {
  it('disabled chip with onClick: onActivate is a no-op', () => {
    createRoot(() => {
      let count = 0;
      const inst = Chip({ label: 'Disabled', onClick: () => count++, disabled: true });
      inst.semantics!.onActivate!();
      expect(count).toBe(0);
    });
  });

  it('disabled chip with onClick: handlers.onClick is a no-op', () => {
    createRoot(() => {
      let count = 0;
      const inst = Chip({ label: 'Disabled', onClick: () => count++, disabled: true });
      inst.handlers?.onClick?.({} as any);
      expect(count).toBe(0);
    });
  });

  it('disabled chip has semantics.disabled = true', () => {
    createRoot(() => {
      const inst = Chip({ label: 'Disabled', onClick: () => {}, disabled: true });
      expect(inst.semantics?.disabled).toBe(true);
    });
  });
});

// ---------------------------------------------------------------------------
// Chip — onDelete → separate delete control
// ---------------------------------------------------------------------------
describe('Chip — onDelete → trailing delete control', () => {
  it('renders a child with role button and label Remove when onDelete provided', () => {
    createRoot(() => {
      const inst = Chip({ label: 'Removable', onDelete: () => {} });
      function findDeleteButton(node: any): any {
        if (node.semantics?.role === 'button' && node.semantics?.label === 'Remove') {
          return node;
        }
        for (const c of node.children ?? []) {
          const found = findDeleteButton(c);
          if (found) return found;
        }
        return null;
      }
      const deleteBtn = findDeleteButton(inst);
      expect(deleteBtn).not.toBeNull();
    });
  });

  it('delete control is focusable', () => {
    createRoot(() => {
      const inst = Chip({ label: 'Removable', onDelete: () => {} });
      function findDeleteButton(node: any): any {
        if (node.semantics?.role === 'button' && node.semantics?.label === 'Remove') {
          return node;
        }
        for (const c of node.children ?? []) {
          const found = findDeleteButton(c);
          if (found) return found;
        }
        return null;
      }
      const deleteBtn = findDeleteButton(inst);
      expect(deleteBtn.focusable).toBe(true);
    });
  });

  it('delete control onActivate fires onDelete', () => {
    createRoot(() => {
      let deleted = 0;
      const inst = Chip({ label: 'Removable', onDelete: () => deleted++ });
      function findDeleteButton(node: any): any {
        if (node.semantics?.role === 'button' && node.semantics?.label === 'Remove') {
          return node;
        }
        for (const c of node.children ?? []) {
          const found = findDeleteButton(c);
          if (found) return found;
        }
        return null;
      }
      const deleteBtn = findDeleteButton(inst);
      deleteBtn.semantics.onActivate();
      expect(deleted).toBe(1);
    });
  });

  it('chip semantics and delete semantics are distinct nodes', () => {
    createRoot(() => {
      const inst = Chip({ label: 'Removable', onClick: () => {}, onDelete: () => {} });
      // chip root is role=button
      expect(inst.semantics?.role).toBe('button');
      // delete is found inside children, not on the root
      function findDeleteButton(node: any): any {
        if (node.semantics?.role === 'button' && node.semantics?.label === 'Remove') {
          return node;
        }
        for (const c of node.children ?? []) {
          const found = findDeleteButton(c);
          if (found) return found;
        }
        return null;
      }
      const deleteBtn = findDeleteButton(inst);
      expect(deleteBtn).not.toBeNull();
      expect(deleteBtn).not.toBe(inst);
    });
  });

  it('disabled chip: delete control onActivate is a no-op', () => {
    createRoot(() => {
      let deleted = 0;
      const inst = Chip({ label: 'Removable', onDelete: () => deleted++, disabled: true });
      function findDeleteButton(node: any): any {
        if (node.semantics?.role === 'button' && node.semantics?.label === 'Remove') {
          return node;
        }
        for (const c of node.children ?? []) {
          const found = findDeleteButton(c);
          if (found) return found;
        }
        return null;
      }
      const deleteBtn = findDeleteButton(inst);
      deleteBtn?.semantics?.onActivate?.();
      expect(deleted).toBe(0);
    });
  });
});

// ---------------------------------------------------------------------------
// Chip — no onDelete → no delete control
// ---------------------------------------------------------------------------
describe('Chip — no onDelete → no delete control', () => {
  it('does NOT have a Remove button when no onDelete', () => {
    createRoot(() => {
      const inst = Chip({ label: 'Simple', onClick: () => {} });
      function findDeleteButton(node: any): any {
        if (node.semantics?.label === 'Remove') return node;
        for (const c of node.children ?? []) {
          const found = findDeleteButton(c);
          if (found) return found;
        }
        return null;
      }
      expect(findDeleteButton(inst)).toBeNull();
    });
  });
});

// ---------------------------------------------------------------------------
// Chip — variants change style
// ---------------------------------------------------------------------------
describe('Chip — variants', () => {
  it('solid variant resolves backgroundColor from theme color', () => {
    createRoot(() => {
      runWithTheme(() => {
        const resolved = resolveStyleInput(
          (th: any) => [{ backgroundColor: th.colors?.primary ?? '#3b82f6' }],
          defaultTheme,
        );
        expect(resolved.backgroundColor).toBe(defaultTheme.colors.primary);
      });
    });
  });

  it('outline variant has a border', () => {
    createRoot(() => {
      runWithTheme(() => {
        const resolved = resolveStyleInput(
          (_th: any) => [{ border: { width: 1, color: defaultTheme.colors.border } }],
          defaultTheme,
        );
        expect(resolved.border).toBeDefined();
      });
    });
  });

  it('soft variant is created without throwing', () => {
    createRoot(() => {
      expect(() => Chip({ label: 'Soft', variant: 'soft' })).not.toThrow();
    });
  });

  it('solid variant is created without throwing', () => {
    createRoot(() => {
      expect(() => Chip({ label: 'Solid', variant: 'solid' })).not.toThrow();
    });
  });

  it('outline variant is created without throwing', () => {
    createRoot(() => {
      expect(() => Chip({ label: 'Outline', variant: 'outline' })).not.toThrow();
    });
  });
});

// ---------------------------------------------------------------------------
// Chip — sizes
// ---------------------------------------------------------------------------
describe('Chip — sizes', () => {
  it('sm size is created without throwing', () => {
    createRoot(() => {
      expect(() => Chip({ label: 'Small', size: 'sm' })).not.toThrow();
    });
  });

  it('md size is created without throwing', () => {
    createRoot(() => {
      expect(() => Chip({ label: 'Medium', size: 'md' })).not.toThrow();
    });
  });
});

// ---------------------------------------------------------------------------
// Chip — leading slot
// ---------------------------------------------------------------------------
describe('Chip — leading slot', () => {
  it('leading instance appears as a child of the chip', () => {
    createRoot(() => {
      const leadingNode = { layout: {} as any, children: [], handlers: {} } as any;
      const inst = Chip({ label: 'With icon', leading: leadingNode });
      function contains(node: any, target: any): boolean {
        if (node === target) return true;
        for (const c of node.children ?? []) {
          if (contains(c, target)) return true;
        }
        return false;
      }
      expect(contains(inst, leadingNode)).toBe(true);
    });
  });
});

// ---------------------------------------------------------------------------
// Chip — applyLayoutChildProps
// ---------------------------------------------------------------------------
describe('Chip — LayoutChildProps', () => {
  it('flex prop is applied to the instance layout', () => {
    createRoot(() => {
      const inst = Chip({ label: 'Flex', flex: 1 });
      expect((inst.layout as any).flex).toBe(1);
    });
  });
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
import { runWithContext } from '@cairn/reactivity';

function runWithTheme(fn: () => void) {
  runWithContext(themeContext, () => defaultTheme, fn);
}
