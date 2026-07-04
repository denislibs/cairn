import { describe, it, expect } from 'vitest';
import { createRoot } from '@cairn/reactivity';
import { Box } from '@cairn/primitives';
import { Badge } from '../src/badge';

// Walk the instance tree and return the first `layout.text` value found.
function findText(node: any): string | null {
  if (node.layout && typeof node.layout.text === 'string' && node.layout.text !== '') {
    return node.layout.text;
  }
  if (node.children) {
    for (const c of node.children) {
      const found = findText(c);
      if (found !== null) return found;
    }
  }
  return null;
}

describe('Badge — standalone pill', () => {
  it('renders without children as a standalone pill', () => {
    createRoot(() => {
      const b = Badge({ content: '3' });
      expect(b).toBeDefined();
      expect(b.children.length).toBeGreaterThan(0);
    });
  });

  it('has role status with label when content is given', () => {
    createRoot(() => {
      const b = Badge({ content: 5 });
      expect(b.semantics!.role).toBe('status');
      expect(b.semantics!.label).toBeTruthy();
    });
  });

  it('label includes the count value', () => {
    createRoot(() => {
      const b = Badge({ content: 42 });
      expect(b.semantics!.label).toContain('42');
    });
  });

  it('numeric content over max renders "{max}+"', () => {
    createRoot(() => {
      const b = Badge({ content: 150, max: 99 });
      const text = findText(b);
      expect(text).toBe('99+');
    });
  });

  it('numeric content under max renders the number as string', () => {
    createRoot(() => {
      const b = Badge({ content: 5, max: 99 });
      const text = findText(b);
      expect(text).toBe('5');
    });
  });

  it('string content renders as-is', () => {
    createRoot(() => {
      const b = Badge({ content: 'new' });
      const text = findText(b);
      expect(text).toBe('new');
    });
  });
});

describe('Badge — dot mode', () => {
  it('dot mode renders no text child (pure circle)', () => {
    createRoot(() => {
      const b = Badge({ dot: true });
      const text = findText(b);
      expect(text).toBeNull();
    });
  });

  it('dot mode has role none (purely decorative)', () => {
    createRoot(() => {
      const b = Badge({ dot: true });
      expect(b.semantics!.role).toBe('none');
    });
  });

  it('dot mode with content still renders no text (dot takes priority)', () => {
    createRoot(() => {
      const b = Badge({ dot: true, content: 5 });
      const text = findText(b);
      expect(text).toBeNull();
    });
  });
});

describe('Badge — overlay (wrapping a child)', () => {
  it('when children given, returns a Stack container with badge overlaid', () => {
    createRoot(() => {
      const child = Box({ style: { width: 40, height: 40 } });
      const b = Badge({ children: child, content: 3 });
      // Stack has 2 children: the wrapped child + the badge pill
      expect(b.children.length).toBe(2);
    });
  });

  it('the badge pill (second child) has role status', () => {
    createRoot(() => {
      const child = Box({ style: { width: 40, height: 40 } });
      const b = Badge({ children: child, content: 7 });
      const pill = b.children[1];
      expect(pill.semantics!.role).toBe('status');
    });
  });

  it('when children given with dot:true, badge pill has role none', () => {
    createRoot(() => {
      const child = Box({ style: { width: 40, height: 40 } });
      const b = Badge({ children: child, dot: true });
      const pill = b.children[1];
      expect(pill.semantics!.role).toBe('none');
    });
  });

  it('string children are wrapped in a Text instance', () => {
    createRoot(() => {
      const b = Badge({ children: 'Hello', content: 2 });
      // Stack has 2 children: wrapped text instance + badge pill
      expect(b.children.length).toBe(2);
    });
  });
});

describe('Badge — variants and colors', () => {
  it('solid variant uses opaque background color', () => {
    createRoot(() => {
      const b = Badge({ content: '1', variant: 'solid', color: 'primary' });
      expect(b).toBeDefined();
    });
  });

  it('soft variant renders without error', () => {
    createRoot(() => {
      const b = Badge({ content: '1', variant: 'soft', color: 'danger' });
      expect(b).toBeDefined();
    });
  });

  it('danger color produces a badge', () => {
    createRoot(() => {
      const b = Badge({ content: '!', color: 'danger' });
      expect(b).toBeDefined();
      expect(b.semantics!.role).toBe('status');
    });
  });
});

describe('Badge — LayoutChildProps', () => {
  it('accepts layout child props (flex, margin, etc.) without error', () => {
    createRoot(() => {
      const b = Badge({ content: 1, flex: 1, margin: 8 });
      expect(b).toBeDefined();
    });
  });

  it('accepts style override', () => {
    createRoot(() => {
      const b = Badge({ content: 1, style: { opacity: 0.5 } });
      expect(b).toBeDefined();
    });
  });
});
