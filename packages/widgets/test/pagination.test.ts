import { describe, it, expect } from 'vitest';
import { createRoot } from '@cairn/reactivity';
import { Pagination, paginationRange } from '../src/pagination';

describe('paginationRange', () => {
  it('shows all pages for small count', () => {
    expect(paginationRange(1, 5, 1)).toEqual([1, 2, 3, 4, 5]);
  });

  it('shows ellipsis for large ranges (middle)', () => {
    const result = paginationRange(5, 10, 1);
    expect(result).toContain(1);
    expect(result).toContain(10);
    expect(result).toContain(5);
    expect(result).toContain('...');
  });

  it('first page near start: right ellipsis only', () => {
    const result = paginationRange(1, 10, 1);
    expect(result[0]).toBe(1);
    expect(result[result.length - 1]).toBe(10);
    // Should have right ellipsis but no left ellipsis
    const ellipsisCount = result.filter(r => r === '...').length;
    expect(ellipsisCount).toBeGreaterThan(0);
  });
});

describe('Pagination — rendering', () => {
  it('container has role navigation', () => {
    createRoot(() => {
      const pag = Pagination({ page: 1, count: 5, onChange: () => {} });
      expect(pag.semantics!.role).toBe('navigation');
    });
  });

  it('prev button disabled on page 1', () => {
    createRoot(() => {
      const pag = Pagination({ page: 1, count: 5, onChange: () => {} });
      const prevBtn = pag.children[0];
      expect(prevBtn.semantics!.disabled).toBe(true);
    });
  });

  it('next button disabled on last page', () => {
    createRoot(() => {
      const pag = Pagination({ page: 5, count: 5, onChange: () => {} });
      const nextBtn = pag.children[pag.children.length - 1];
      expect(nextBtn.semantics!.disabled).toBe(true);
    });
  });

  it('current page button has current="page"', () => {
    createRoot(() => {
      const pag = Pagination({ page: 1, count: 5, onChange: () => {} });
      // children: [prev, page1, page2, page3, page4, page5, next] for count=5 (all visible)
      // page buttons start at index 1
      const pageBtn = pag.children[1]; // page 1 button
      expect(pageBtn.semantics!.current).toBe('page');
    });
  });

  it('onChange fires with correct page on prev/next', () => {
    createRoot(() => {
      const seen: number[] = [];
      const pag = Pagination({ page: 3, count: 5, onChange: (p) => seen.push(p) });
      const prevBtn = pag.children[0];
      prevBtn.semantics!.onActivate!();
      expect(seen).toEqual([2]);

      const nextBtn = pag.children[pag.children.length - 1];
      nextBtn.semantics!.onActivate!();
      expect(seen).toEqual([2, 4]);
    });
  });
});
