import { LayoutNode } from './node';
import { type Constraints, type Size, type LayoutContext, clamp } from './types';

export type FlexDirection = 'row' | 'column';
export type Justify = 'start' | 'center' | 'end' | 'space-between' | 'space-around';
export type Align = 'start' | 'center' | 'end' | 'stretch';

export interface FlexNodeProps {
  direction?: FlexDirection;
  gap?: number;
  rowGap?: number;
  columnGap?: number;
  justify?: Justify;
  align?: Align;
  mainAxisSize?: 'min' | 'max';
  width?: number;
  height?: number;
  children?: LayoutNode[];
}

export class FlexNode extends LayoutNode {
  direction: FlexDirection;
  gap: number;
  rowGap?: number;
  columnGap?: number;
  justify: Justify;
  align: Align;
  mainAxisSize: 'min' | 'max';
  width?: number;
  height?: number;

  constructor(props: FlexNodeProps = {}) {
    super();
    this.direction = props.direction ?? 'row';
    this.gap = props.gap ?? 0;
    this.rowGap = props.rowGap;
    this.columnGap = props.columnGap;
    this.justify = props.justify ?? 'start';
    this.align = props.align ?? 'start';
    this.mainAxisSize = props.mainAxisSize ?? 'max';
    this.width = props.width;
    this.height = props.height;
    this.children = props.children ?? [];
  }

  layout(c: Constraints, ctx: LayoutContext): Size {
    const isRow = this.direction === 'row';
    const gap = (isRow ? this.columnGap : this.rowGap) ?? this.gap;
    const mainMax = isRow ? c.maxW : c.maxH;
    const crossMax = isRow ? c.maxH : c.maxW;
    const n = this.children.length;
    const gapTotal = gap * Math.max(0, n - 1);

    const mainSize = (s: Size): number => (isRow ? s.w : s.h);
    const crossSize = (s: Size): number => (isRow ? s.h : s.w);
    const marginMain = (ch: LayoutNode): number => (isRow ? ch.margin.left + ch.margin.right : ch.margin.top + ch.margin.bottom);
    const marginCross = (ch: LayoutNode): number => (isRow ? ch.margin.top + ch.margin.bottom : ch.margin.left + ch.margin.right);
    const leadMain = (ch: LayoutNode): number => (isRow ? ch.margin.left : ch.margin.top);
    const leadCross = (ch: LayoutNode): number => (isRow ? ch.margin.top : ch.margin.left);
    const crossRange = (): [number, number] =>
      this.align === 'stretch' && isFinite(crossMax) ? [crossMax, crossMax] : [0, crossMax];
    const make = (mainLo: number, mainHi: number, crossLo: number, crossHi: number): Constraints =>
      isRow
        ? { minW: mainLo, maxW: mainHi, minH: crossLo, maxH: crossHi }
        : { minW: crossLo, maxW: crossHi, minH: mainLo, maxH: mainHi };

    // Phase 1: non-flex children get loose main + align-driven cross constraints.
    let usedMain = gapTotal;
    let maxCross = 0;
    const flexChildren: LayoutNode[] = [];
    let totalFlex = 0;
    for (const ch of this.children) {
      if (ch.flex > 0) {
        flexChildren.push(ch);
        totalFlex += ch.flex;
        continue;
      }
      const [clo, chi] = crossRange();
      const s = ch.layout(make(0, mainMax, clo, chi), ctx);
      usedMain += mainSize(s) + marginMain(ch);
      maxCross = Math.max(maxCross, crossSize(s) + marginCross(ch));
    }

    // Phase 2: flex children split the remaining main-axis space (tight main extent).
    const explicitMain = isRow ? this.width : this.height;
    // Reserve flex children's margins before computing free space.
    for (const ch of flexChildren) usedMain += marginMain(ch);
    const availMain = explicitMain != null ? explicitMain : isFinite(mainMax) ? mainMax : usedMain;
    const free = Math.max(0, availMain - usedMain);
    for (const ch of flexChildren) {
      const share = totalFlex > 0 ? (free * ch.flex) / totalFlex : 0;
      const [clo, chi] = crossRange();
      const s = ch.layout(make(share, share, clo, chi), ctx);
      maxCross = Math.max(maxCross, crossSize(s) + marginCross(ch));
    }

    // Own size.
    const contentMain = this.children.reduce((sum, ch) => sum + mainSize(ch.size) + marginMain(ch), 0) + gapTotal;
    const minMain = isRow ? c.minW : c.minH;
    const ownMain =
      explicitMain != null
        ? clamp(explicitMain, minMain, isFinite(mainMax) ? mainMax : explicitMain)
        : this.mainAxisSize === 'min'
          ? clamp(contentMain, minMain, isFinite(mainMax) ? mainMax : contentMain)
          : isFinite(mainMax)
            ? mainMax
            : contentMain;
    const explicitCross = isRow ? this.height : this.width;
    const minCross = isRow ? c.minH : c.minW;
    const ownCross =
      explicitCross != null
        ? clamp(explicitCross, minCross, crossMax)
        : this.align === 'stretch' && isFinite(crossMax)
          ? crossMax
          : clamp(maxCross, minCross, crossMax);

    // Position along the main axis per justify.
    const freeMain = Math.max(0, ownMain - contentMain);
    let cursor = 0;
    let between = gap;
    switch (this.justify) {
      case 'start':
        cursor = 0;
        break;
      case 'center':
        cursor = freeMain / 2;
        break;
      case 'end':
        cursor = freeMain;
        break;
      case 'space-between':
        cursor = 0;
        between = gap + (n > 1 ? freeMain / (n - 1) : 0);
        break;
      case 'space-around': {
        const around = n > 0 ? freeMain / n : 0;
        cursor = around / 2;
        between = gap + around;
        break;
      }
    }

    // Place each child: main via cursor, cross via align / alignSelf.
    for (const ch of this.children) {
      const cs = crossSize(ch.size) + marginCross(ch);
      // Per-child cross alignment: ch.alignSelf overrides the container's align.
      // 'stretch' on an individual child is deferred in v1 — it falls through to 'start'.
      const self = ch.alignSelf ?? this.align;
      let crossOffset = 0;
      if (self === 'center') crossOffset = (ownCross - cs) / 2;
      else if (self === 'end') crossOffset = ownCross - cs;
      // 'start', 'stretch', and undefined -> 0

      const mainStart = cursor + leadMain(ch);
      const crossStart = crossOffset + leadCross(ch);
      if (isRow) {
        ch.offsetX = mainStart;
        ch.offsetY = crossStart;
      } else {
        ch.offsetX = crossStart;
        ch.offsetY = mainStart;
      }
      cursor += mainSize(ch.size) + marginMain(ch) + between;
    }

    this.size = isRow ? { w: ownMain, h: ownCross } : { w: ownCross, h: ownMain };
    return this.size;
  }
}
