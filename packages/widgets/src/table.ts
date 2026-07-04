import type { Instance, SemanticsNode } from '@cairn/runtime';
import { Box, Row, Column, Text, applyLayoutChildProps, mergeStyles, type StyleInput, type LayoutChildProps } from '@cairn/primitives';
import { useWidgetTheme } from './theme';

// ─── Public Types ─────────────────────────────────────────────────────────────

export interface TableColumn {
  key: string;
  header: string;
  width?: number;
  align?: 'left' | 'right' | 'center';
}

export interface TableProps extends LayoutChildProps {
  columns: TableColumn[];
  rows: Record<string, any>[];
  getRowKey?: (row: Record<string, any>, index: number) => any;
  style?: StyleInput;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Build a single header cell (role: columnheader). */
function buildHeaderCell(col: TableColumn, t: ReturnType<typeof useWidgetTheme>): Instance {
  const align = col.align ?? 'left';
  const textStyle: StyleInput = {
    fontWeight: t.fontWeights.bold,
    fontSize: t.fontSizes.sm,
    color: t.colors.text,
    textAlign: align,
  };

  const textNode = Text({ children: col.header, style: textStyle });
  // Store style on text node for testability (textAlign is paint-only, not on layout)
  (textNode as any).style = textStyle;

  const cellStyle: StyleInput = {
    padding: {
      left: t.spacing.sm,
      right: t.spacing.sm,
      top: t.spacing.xs,
      bottom: t.spacing.xs,
    },
    borderBottom: { width: 1, color: t.colors.border },
    ...(col.width != null ? { width: col.width } : {}),
  };

  const cell = Box({ style: cellStyle, children: textNode });
  const sem: SemanticsNode = { role: 'columnheader', label: col.header };
  cell.semantics = sem;
  return cell;
}

/** Build a single data cell (role: cell). */
function buildDataCell(
  col: TableColumn,
  value: any,
  t: ReturnType<typeof useWidgetTheme>,
): Instance {
  const rawValue = value == null ? '' : String(value);
  const align = col.align ?? 'left';
  const textStyle: StyleInput = {
    fontSize: t.fontSizes.sm,
    color: t.colors.text,
    textAlign: align,
  };

  const textNode = Text({ children: rawValue, style: textStyle });
  // Store style on text node for testability (textAlign is paint-only, not on layout)
  (textNode as any).style = textStyle;

  const cellStyle: StyleInput = {
    padding: {
      left: t.spacing.sm,
      right: t.spacing.sm,
      top: t.spacing.xs,
      bottom: t.spacing.xs,
    },
    ...(col.width != null ? { width: col.width } : {}),
  };

  const cell = Box({ style: cellStyle, children: textNode });
  // The cell's Text child is canvas-painted, not a DOM node — surface the value
  // as the cell's accessible label so AT reads it (empty string → no label).
  const sem: SemanticsNode = { role: 'cell', label: rawValue || undefined };
  cell.semantics = sem;
  return cell;
}

// ─── Table Component ──────────────────────────────────────────────────────────

export function Table(props: TableProps): Instance {
  const t = useWidgetTheme();
  const { columns, rows } = props;

  // ── Header row ──────────────────────────────────────────────────────────────
  const headerCells = columns.map((col) => buildHeaderCell(col, t));

  const headerRow = Row({
    mainAxisSize: 'max',
    style: {
      backgroundColor: t.colors.surfaceAlt,
    },
    children: headerCells,
  });

  const headerRowSem: SemanticsNode = { role: 'row' };
  headerRow.semantics = headerRowSem;

  // ── Data rows ───────────────────────────────────────────────────────────────
  const dataRows: Instance[] = rows.map((row, _i) => {
    const cells = columns.map((col) => buildDataCell(col, row[col.key], t));

    const dataRow = Row({
      mainAxisSize: 'max',
      style: {
        borderBottom: { width: 1, color: t.colors.border },
      },
      children: cells,
    });

    const rowSem: SemanticsNode = { role: 'row' };
    dataRow.semantics = rowSem;
    return dataRow;
  });

  // ── Container (role: table) ─────────────────────────────────────────────────
  const allRows: Instance[] = [headerRow, ...dataRows];

  const container = Column({
    mainAxisSize: 'max',
    style: mergeStyles(
      {
        border: { width: 1, color: t.colors.border },
        borderRadius: t.radii.sm,
        backgroundColor: t.colors.surface,
      },
      props.style,
    ),
    children: allRows,
  });

  const tableSem: SemanticsNode = { role: 'table' };
  container.semantics = tableSem;

  applyLayoutChildProps(container, props);
  return container;
}
