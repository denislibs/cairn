import { describe, it, expect } from 'vitest';
import { createRoot } from '@cairn/reactivity';
import { Table } from '../src/table';
import type { TableColumn } from '../src/table';

// ─── Fixtures ────────────────────────────────────────────────────────────────

const COLUMNS: TableColumn[] = [
  { key: 'name', header: 'Name' },
  { key: 'age', header: 'Age', align: 'right' },
  { key: 'city', header: 'City', width: 120 },
];

const ROWS = [
  { name: 'Alice', age: 30, city: 'London' },
  { name: 'Bob', age: 25, city: 'Paris' },
  { name: 'Charlie', age: 35, city: 'Berlin' },
];

// ─── Container semantics ─────────────────────────────────────────────────────

describe('Table — container semantics', () => {
  it('container has role table', () => {
    createRoot(() => {
      const t = Table({ columns: COLUMNS, rows: ROWS });
      expect(t.semantics!.role).toBe('table');
    });
  });
});

// ─── Header row ──────────────────────────────────────────────────────────────

describe('Table — header row', () => {
  it('first child is the header row with role row', () => {
    createRoot(() => {
      const t = Table({ columns: COLUMNS, rows: ROWS });
      const headerRow = t.children[0];
      expect(headerRow.semantics!.role).toBe('row');
    });
  });

  it('header row has one cell per column with role columnheader', () => {
    createRoot(() => {
      const t = Table({ columns: COLUMNS, rows: ROWS });
      const headerRow = t.children[0];
      expect(headerRow.children.length).toBe(COLUMNS.length);
      for (const cell of headerRow.children) {
        expect(cell.semantics!.role).toBe('columnheader');
      }
    });
  });

  it('header cells contain Text with the column header label', () => {
    createRoot(() => {
      const t = Table({ columns: COLUMNS, rows: ROWS });
      const headerRow = t.children[0];
      // Each header cell (Box) has a Text child
      const firstCell = headerRow.children[0];
      const textNode = firstCell.children[0];
      expect((textNode.layout as any).text).toBe('Name');
    });
  });
});

// ─── Data rows ───────────────────────────────────────────────────────────────

describe('Table — data rows', () => {
  it('renders one row per data entry (after the header)', () => {
    createRoot(() => {
      const t = Table({ columns: COLUMNS, rows: ROWS });
      // children[0] = header row, children[1..N] = data rows
      expect(t.children.length).toBe(ROWS.length + 1);
    });
  });

  it('each data row has role row', () => {
    createRoot(() => {
      const t = Table({ columns: COLUMNS, rows: ROWS });
      for (let i = 1; i <= ROWS.length; i++) {
        expect(t.children[i].semantics!.role).toBe('row');
      }
    });
  });

  it('each data row has M cells with role cell', () => {
    createRoot(() => {
      const t = Table({ columns: COLUMNS, rows: ROWS });
      const dataRow = t.children[1]; // first data row
      expect(dataRow.children.length).toBe(COLUMNS.length);
      for (const cell of dataRow.children) {
        expect(cell.semantics!.role).toBe('cell');
      }
    });
  });

  it('cell text reflects the row data value for the column key', () => {
    createRoot(() => {
      const t = Table({ columns: COLUMNS, rows: ROWS });
      // First data row = Alice
      const dataRow = t.children[1];
      const nameCell = dataRow.children[0]; // 'name' column
      const textNode = nameCell.children[0];
      expect((textNode.layout as any).text).toBe('Alice');
    });
  });

  it('numeric values are coerced to string', () => {
    createRoot(() => {
      const t = Table({ columns: COLUMNS, rows: ROWS });
      const dataRow = t.children[1];
      const ageCell = dataRow.children[1]; // 'age' column
      const textNode = ageCell.children[0];
      expect((textNode.layout as any).text).toBe('30');
    });
  });

  it('missing cell values render as empty string', () => {
    createRoot(() => {
      const sparseRows = [{ name: 'Alice' }]; // age and city missing
      const t = Table({ columns: COLUMNS, rows: sparseRows });
      const dataRow = t.children[1];
      const ageCell = dataRow.children[1]; // 'age' is undefined
      const textNode = ageCell.children[0];
      expect((textNode.layout as any).text).toBe('');
    });
  });
});

// ─── Empty rows ──────────────────────────────────────────────────────────────

describe('Table — empty rows', () => {
  it('only the header row renders when rows is empty', () => {
    createRoot(() => {
      const t = Table({ columns: COLUMNS, rows: [] });
      expect(t.children.length).toBe(1);
      expect(t.children[0].semantics!.role).toBe('row');
    });
  });
});

// ─── Column alignment ────────────────────────────────────────────────────────

describe('Table — column align', () => {
  it('right-aligned column cell text has textAlign right in style', () => {
    createRoot(() => {
      const t = Table({ columns: COLUMNS, rows: ROWS });
      const dataRow = t.children[1];
      const ageCell = dataRow.children[1]; // align: 'right'
      const textNode = ageCell.children[0];
      // The text node's style carries textAlign
      const style = typeof (textNode as any).style === 'function'
        ? (textNode as any).style()
        : (textNode as any).style;
      expect(style?.textAlign).toBe('right');
    });
  });

  it('default-aligned column uses left alignment', () => {
    createRoot(() => {
      const t = Table({ columns: COLUMNS, rows: ROWS });
      const dataRow = t.children[1];
      const nameCell = dataRow.children[0]; // no align specified → 'left'
      const textNode = nameCell.children[0];
      const style = typeof (textNode as any).style === 'function'
        ? (textNode as any).style()
        : (textNode as any).style;
      expect(style?.textAlign ?? 'left').toBe('left');
    });
  });
});

// ─── Column width ────────────────────────────────────────────────────────────

describe('Table — column width', () => {
  it('column with explicit width applies it to header cells', () => {
    createRoot(() => {
      const t = Table({ columns: COLUMNS, rows: ROWS });
      const headerRow = t.children[0];
      const cityHeader = headerRow.children[2]; // 'city' has width: 120
      expect((cityHeader.layout as any).width).toBe(120);
    });
  });

  it('column with explicit width applies it to data cells', () => {
    createRoot(() => {
      const t = Table({ columns: COLUMNS, rows: ROWS });
      const dataRow = t.children[1];
      const cityCell = dataRow.children[2]; // 'city' has width: 120
      expect((cityCell.layout as any).width).toBe(120);
    });
  });
});

// ─── LayoutChildProps ────────────────────────────────────────────────────────

describe('Table — applyLayoutChildProps', () => {
  it('forwards flex prop to layout node', () => {
    createRoot(() => {
      const t = Table({ columns: COLUMNS, rows: ROWS, flex: 1 });
      expect((t.layout as any).flex).toBe(1);
    });
  });
});

// ─── style prop ──────────────────────────────────────────────────────────────

describe('Table — style prop', () => {
  it('accepts a style prop without throwing', () => {
    createRoot(() => {
      expect(() => Table({ columns: COLUMNS, rows: ROWS, style: { opacity: 0.9 } })).not.toThrow();
    });
  });
});

// ─── getRowKey ───────────────────────────────────────────────────────────────

describe('Table — getRowKey', () => {
  it('accepts getRowKey prop without throwing', () => {
    createRoot(() => {
      expect(() =>
        Table({ columns: COLUMNS, rows: ROWS, getRowKey: (row, i) => row.name ?? i })
      ).not.toThrow();
    });
  });
});
