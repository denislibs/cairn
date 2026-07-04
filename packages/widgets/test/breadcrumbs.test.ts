import { describe, it, expect } from 'vitest';
import { createRoot } from '@cairn/reactivity';
import { Breadcrumbs } from '../src/breadcrumbs';

const ITEMS = [
  { label: 'Home', onClick: () => {} },
  { label: 'Products', onClick: () => {} },
  { label: 'Widget' },
];

describe('Breadcrumbs — structure', () => {
  it('container has role navigation', () => {
    createRoot(() => {
      const bc = Breadcrumbs({ items: ITEMS });
      expect(bc.semantics!.role).toBe('navigation');
      expect(bc.semantics!.label).toBe('Breadcrumb');
    });
  });

  it('renders expected number of children (items + separators)', () => {
    createRoot(() => {
      const bc = Breadcrumbs({ items: ITEMS });
      // 3 items: Home + sep + Products + sep + Widget = 5 children
      expect(bc.children.length).toBe(5);
    });
  });

  it('last item has current="page"', () => {
    createRoot(() => {
      const bc = Breadcrumbs({ items: ITEMS });
      const lastChild = bc.children[bc.children.length - 1];
      expect(lastChild.semantics!.current).toBe('page');
    });
  });

  it('non-last items have role link', () => {
    createRoot(() => {
      const bc = Breadcrumbs({ items: ITEMS });
      const first = bc.children[0];
      expect(first.semantics!.role).toBe('link');
    });
  });
});

describe('Breadcrumbs — interaction', () => {
  it('onClick fires for non-last items via onActivate', () => {
    createRoot(() => {
      const seen: string[] = [];
      const items = [
        { label: 'Home', onClick: () => seen.push('home') },
        { label: 'Page' },
      ];
      const bc = Breadcrumbs({ items });
      // First item (index 0) is the Home link
      const homeLink = bc.children[0];
      homeLink.semantics!.onActivate!();
      expect(seen).toEqual(['home']);
    });
  });
});
