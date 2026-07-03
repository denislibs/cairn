import { LayoutNode } from './node';
import { type Constraints, type Size, type LayoutContext, clamp } from './types';
import { parseTracks, type TrackSize } from './grid-parse';

export type GridAlign = 'start' | 'center' | 'end' | 'stretch';

export interface GridNodeProps {
  templateColumns?: string | TrackSize[];
  templateRows?: string | TrackSize[];
  rowGap?: number;
  columnGap?: number;
  templateAreas?: string[][];
  justifyItems?: GridAlign;
  alignItems?: GridAlign;
  children?: LayoutNode[];
}

/** Resolved 0-based half-open placement for one child: [colStart, colEnd, rowStart, rowEnd] */
interface CellPlacement {
  c0: number;
  c1: number;
  r0: number;
  r1: number;
}

export class GridNode extends LayoutNode {
  templateColumns: TrackSize[];
  templateRows: TrackSize[];
  rowGap: number;
  columnGap: number;
  templateAreas?: string[][];
  justifyItems: GridAlign;
  alignItems: GridAlign;

  /** Computed after layout() — exposed for tests */
  colWidths: number[] = [];
  rowHeights: number[] = [];

  constructor(props: GridNodeProps = {}) {
    super();
    this.templateColumns = parseTracks(props.templateColumns ?? '1fr');
    this.templateRows = parseTracks(props.templateRows ?? []);
    this.rowGap = props.rowGap ?? 0;
    this.columnGap = props.columnGap ?? 0;
    this.templateAreas = props.templateAreas;
    this.justifyItems = props.justifyItems ?? 'stretch';
    this.alignItems = props.alignItems ?? 'stretch';
    this.children = props.children ?? [];
  }

  layout(c: Constraints, ctx: LayoutContext): Size {
    const numCols = this.templateColumns.length || 1;

    // ── Step 1: Placement ──────────────────────────────────────────────────
    const placements: CellPlacement[] = new Array(this.children.length);

    // Sparse used-cell set: key = `${row},${col}`
    const used = new Set<string>();
    const markUsed = (r0: number, r1: number, c0: number, c1: number) => {
      for (let r = r0; r < r1; r++)
        for (let col = c0; col < c1; col++)
          used.add(`${r},${col}`);
    };
    const isFree = (r: number, col: number) => !used.has(`${r},${col}`);

    // Auto-flow cursor
    let autoCursorRow = 0;
    let autoCursorCol = 0;

    // Helper: find next free position for an item of given colSpan
    const findNextFree = (colSpan: number): { r: number; c: number } => {
      let r = autoCursorRow;
      let col = autoCursorCol;
      // eslint-disable-next-line no-constant-condition
      while (true) {
        // Check if item fits at (r, col)
        if (col + colSpan <= numCols) {
          let fits = true;
          for (let dc = 0; dc < colSpan; dc++) {
            if (!isFree(r, col + dc)) { fits = false; break; }
          }
          if (fits) return { r, c: col };
        }
        // Advance
        col++;
        if (col >= numCols) { col = 0; r++; }
      }
    };

    // Build area map if templateAreas provided
    // areaMap: name -> {c0, c1, r0, r1}
    const areaMap = new Map<string, CellPlacement>();
    if (this.templateAreas) {
      for (let ri = 0; ri < this.templateAreas.length; ri++) {
        const rowDef = this.templateAreas[ri];
        for (let ci = 0; ci < rowDef.length; ci++) {
          const name = rowDef[ci];
          if (!name || name === '.') continue;
          const ex = areaMap.get(name);
          if (ex) {
            ex.c0 = Math.min(ex.c0, ci);
            ex.c1 = Math.max(ex.c1, ci + 1);
            ex.r0 = Math.min(ex.r0, ri);
            ex.r1 = Math.max(ex.r1, ri + 1);
          } else {
            areaMap.set(name, { c0: ci, c1: ci + 1, r0: ri, r1: ri + 1 });
          }
        }
      }
    }

    for (let i = 0; i < this.children.length; i++) {
      const ch = this.children[i];

      // Try gridArea first
      if (ch.gridArea && areaMap.has(ch.gridArea)) {
        placements[i] = { ...areaMap.get(ch.gridArea)! };
        markUsed(placements[i].r0, placements[i].r1, placements[i].c0, placements[i].c1);
        continue;
      }

      // Resolve column placement (1-based → 0-based)
      let c0: number | undefined;
      let c1: number | undefined;
      let colSpan = ch.gridColumnSpan ?? 1;

      if (ch.gridColumnStart != null) {
        c0 = ch.gridColumnStart - 1;
        if (ch.gridColumnEnd != null) {
          c1 = ch.gridColumnEnd - 1; // end line is exclusive in CSS grid (line N means after col N-1)
        } else {
          c1 = c0 + colSpan;
        }
      } else if (ch.gridColumnEnd != null) {
        c1 = ch.gridColumnEnd - 1;
        c0 = c1 - colSpan;
      }

      // Resolve row placement
      let r0: number | undefined;
      let r1: number | undefined;
      let rowSpan = ch.gridRowSpan ?? 1;

      if (ch.gridRowStart != null) {
        r0 = ch.gridRowStart - 1;
        if (ch.gridRowEnd != null) {
          r1 = ch.gridRowEnd - 1;
        } else {
          r1 = r0 + rowSpan;
        }
      } else if (ch.gridRowEnd != null) {
        r1 = ch.gridRowEnd - 1;
        r0 = r1 - rowSpan;
      }

      // Auto-place missing axes
      if (c0 !== undefined && r0 === undefined) {
        // Column known, row auto: find next free row at that column
        let testRow = 0;
        while (!isFree(testRow, c0)) testRow++;
        r0 = testRow;
        r1 = r0 + rowSpan;
      } else if (r0 !== undefined && c0 === undefined) {
        // Row known, column auto: place in first free col of that row
        let testCol = 0;
        while (testCol + colSpan <= numCols) {
          let fits = true;
          for (let dc = 0; dc < colSpan; dc++) {
            if (!isFree(r0!, testCol + dc)) { fits = false; break; }
          }
          if (fits) { c0 = testCol; break; }
          testCol++;
        }
        if (c0 === undefined) c0 = 0;
        c1 = c0 + colSpan;
      } else if (c0 === undefined && r0 === undefined) {
        // Full auto-flow
        const pos = findNextFree(colSpan);
        c0 = pos.c;
        r0 = pos.r;
        c1 = c0 + colSpan;
        r1 = r0 + rowSpan;
        // Advance cursor past this item
        autoCursorRow = r0;
        autoCursorCol = c1;
        if (autoCursorCol >= numCols) { autoCursorCol = 0; autoCursorRow++; }
      }

      if (c1 === undefined) c1 = (c0 ?? 0) + colSpan;
      if (r1 === undefined) r1 = (r0 ?? 0) + rowSpan;

      placements[i] = { c0: c0 ?? 0, c1, r0: r0 ?? 0, r1 };
      markUsed(placements[i].r0, placements[i].r1, placements[i].c0, placements[i].c1);
    }

    // Determine number of rows needed
    let numRows = this.templateRows.length;
    for (const p of placements) numRows = Math.max(numRows, p.r1);
    if (numRows === 0) numRows = 1;

    // ── Step 2: Column sizing ──────────────────────────────────────────────
    const availW = isFinite(c.maxW) ? c.maxW : 0;
    const totalColGaps = this.columnGap * Math.max(0, numCols - 1);

    // First pass: measure px and auto columns
    const colWidths: number[] = new Array(numCols).fill(0);

    // For auto columns: measure children whose span is exactly that single column
    const intrinsicW: number[] = new Array(numCols).fill(0);
    for (let i = 0; i < this.children.length; i++) {
      const p = placements[i];
      if (p.c1 - p.c0 === 1) {
        const colIdx = p.c0;
        if (colIdx < numCols && this.templateColumns[colIdx]?.kind === 'auto') {
          // Measure loosely
          const ch = this.children[i];
          const s = ch.layout({ minW: 0, maxW: Infinity, minH: 0, maxH: Infinity }, ctx);
          intrinsicW[colIdx] = Math.max(intrinsicW[colIdx], s.w);
        }
      }
    }

    let sumPx = 0;
    let sumAuto = 0;
    let totalFr = 0;

    for (let ci = 0; ci < numCols; ci++) {
      const track = this.templateColumns[ci] ?? { kind: 'auto' };
      if (track.kind === 'px') {
        colWidths[ci] = track.value;
        sumPx += track.value;
      } else if (track.kind === 'auto') {
        colWidths[ci] = intrinsicW[ci];
        sumAuto += intrinsicW[ci];
      } else {
        totalFr += track.value;
      }
    }

    const frSpace = Math.max(0, availW - sumPx - sumAuto - totalColGaps);
    for (let ci = 0; ci < numCols; ci++) {
      const track = this.templateColumns[ci] ?? { kind: 'auto' };
      if (track.kind === 'fr') {
        colWidths[ci] = totalFr > 0 ? (frSpace * track.value) / totalFr : 0;
      }
    }

    this.colWidths = colWidths;

    // Compute column offsets
    const colOffsets: number[] = new Array(numCols).fill(0);
    for (let ci = 1; ci < numCols; ci++) {
      colOffsets[ci] = colOffsets[ci - 1] + colWidths[ci - 1] + this.columnGap;
    }

    // ── Step 3: Row sizing (two-pass) ──────────────────────────────────────
    // Pass 3a: lay each child out at its resolved cell width (loose height)
    //          to get natural heights for auto rows.
    const cellW = (p: CellPlacement): number => {
      let w = 0;
      for (let ci = p.c0; ci < p.c1; ci++) {
        w += colWidths[ci];
        if (ci < p.c1 - 1) w += this.columnGap;
      }
      return w;
    };

    // Lay out children loosely (for row height measurement)
    const naturalHeights: number[] = new Array(this.children.length).fill(0);
    for (let i = 0; i < this.children.length; i++) {
      const p = placements[i];
      const ch = this.children[i];
      const cw = cellW(p);
      // Use stretch for column width if justifyItems is stretch, else loose
      const wMin = this.justifyItems === 'stretch' ? cw : 0;
      const s = ch.layout({ minW: wMin, maxW: cw, minH: 0, maxH: Infinity }, ctx);
      naturalHeights[i] = s.h;
    }

    // Pass 3b: size rows
    const availH = c.maxH;
    const totalRowGaps = this.rowGap * Math.max(0, numRows - 1);
    const rowHeights: number[] = new Array(numRows).fill(0);

    // For auto rows: max natural height of items spanning exactly that row
    for (let i = 0; i < this.children.length; i++) {
      const p = placements[i];
      if (p.r1 - p.r0 === 1) {
        const ri = p.r0;
        if (ri < numRows) {
          const rowTrack = this.templateRows[ri] ?? { kind: 'auto' };
          if (rowTrack.kind === 'auto') {
            rowHeights[ri] = Math.max(rowHeights[ri], naturalHeights[i]);
          }
        }
      }
    }

    let sumRowPx = 0;
    let sumRowAuto = 0;
    let totalRowFr = 0;

    for (let ri = 0; ri < numRows; ri++) {
      const track = this.templateRows[ri] ?? { kind: 'auto' };
      if (track.kind === 'px') {
        rowHeights[ri] = track.value;
        sumRowPx += track.value;
      } else if (track.kind === 'auto') {
        // Already set from intrinsic measurement above
        sumRowAuto += rowHeights[ri];
      } else {
        totalRowFr += track.value;
      }
    }

    const frRowSpace = isFinite(availH) ? Math.max(0, availH - sumRowPx - sumRowAuto - totalRowGaps) : 0;
    for (let ri = 0; ri < numRows; ri++) {
      const track = this.templateRows[ri] ?? { kind: 'auto' };
      if (track.kind === 'fr') {
        rowHeights[ri] = isFinite(availH) && totalRowFr > 0 ? (frRowSpace * track.value) / totalRowFr : 0;
      }
    }

    this.rowHeights = rowHeights;

    // Compute row offsets
    const rowOffsets: number[] = new Array(numRows).fill(0);
    for (let ri = 1; ri < numRows; ri++) {
      rowOffsets[ri] = rowOffsets[ri - 1] + rowHeights[ri - 1] + this.rowGap;
    }

    // ── Step 4: Item layout + position ────────────────────────────────────
    const cellH = (p: CellPlacement): number => {
      let h = 0;
      for (let ri = p.r0; ri < p.r1; ri++) {
        h += rowHeights[ri];
        if (ri < p.r1 - 1) h += this.rowGap;
      }
      return h;
    };

    for (let i = 0; i < this.children.length; i++) {
      const ch = this.children[i];
      const p = placements[i];
      const cw = cellW(p);
      const ch_ = cellH(p);

      // Determine layout constraints
      const wMin = this.justifyItems === 'stretch' ? cw : 0;
      const wMax = cw;
      const hMin = this.alignItems === 'stretch' ? ch_ : 0;
      const hMax = this.alignItems === 'stretch' ? ch_ : ch_;

      const s = ch.layout({ minW: wMin, maxW: wMax, minH: hMin, maxH: hMax }, ctx);

      // Position within cell
      const cellX = colOffsets[p.c0];
      const cellY = rowOffsets[p.r0];

      let dx = 0;
      if (this.justifyItems === 'center') dx = (cw - s.w) / 2;
      else if (this.justifyItems === 'end') dx = cw - s.w;

      let dy = 0;
      if (this.alignItems === 'center') dy = (ch_ - s.h) / 2;
      else if (this.alignItems === 'end') dy = ch_ - s.h;

      ch.offsetX = cellX + dx;
      ch.offsetY = cellY + dy;
    }

    // ── Step 5: Own size ───────────────────────────────────────────────────
    const contentW = numCols > 0 ? colOffsets[numCols - 1] + colWidths[numCols - 1] : 0;
    const contentH = numRows > 0 ? rowOffsets[numRows - 1] + rowHeights[numRows - 1] : 0;

    this.size = {
      w: clamp(contentW, c.minW, isFinite(c.maxW) ? c.maxW : contentW),
      h: clamp(contentH, c.minH, isFinite(c.maxH) ? c.maxH : contentH),
    };
    return this.size;
  }
}
