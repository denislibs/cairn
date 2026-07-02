import { LayoutNode } from './node';
import { type Constraints, type Size, type LayoutContext, clamp } from './types';

export type FlexDirection = 'row' | 'column';
export type Justify = 'start' | 'center' | 'end' | 'space-between' | 'space-around';
export type Align = 'start' | 'center' | 'end' | 'stretch';

export interface FlexNodeProps {
  direction?: FlexDirection;
  gap?: number;
  justify?: Justify;
  align?: Align;
  mainAxisSize?: 'min' | 'max';
  children?: LayoutNode[];
}

export class FlexNode extends LayoutNode {
  direction: FlexDirection;
  gap: number;
  justify: Justify;
  align: Align;
  mainAxisSize: 'min' | 'max';

  constructor(props: FlexNodeProps = {}) {
    super();
    this.direction = props.direction ?? 'row';
    this.gap = props.gap ?? 0;
    this.justify = props.justify ?? 'start';
    this.align = props.align ?? 'start';
    this.mainAxisSize = props.mainAxisSize ?? 'max';
    this.children = props.children ?? [];
  }

  layout(c: Constraints, ctx: LayoutContext): Size {
    const isRow = this.direction === 'row';
    const mainMax = isRow ? c.maxW : c.maxH;
    const crossMax = isRow ? c.maxH : c.maxW;
    const n = this.children.length;
    const gapTotal = this.gap * Math.max(0, n - 1);

    const mainSize = (s: Size): number => (isRow ? s.w : s.h);
    const crossSize = (s: Size): number => (isRow ? s.h : s.w);
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
      usedMain += mainSize(s);
      maxCross = Math.max(maxCross, crossSize(s));
    }

    // Phase 2: flex children split the remaining main-axis space (tight main extent).
    const free = Math.max(0, (isFinite(mainMax) ? mainMax : usedMain) - usedMain);
    for (const ch of flexChildren) {
      const share = totalFlex > 0 ? (free * ch.flex) / totalFlex : 0;
      const [clo, chi] = crossRange();
      const s = ch.layout(make(share, share, clo, chi), ctx);
      maxCross = Math.max(maxCross, crossSize(s));
    }

    // Own size.
    const contentMain = this.children.reduce((sum, ch) => sum + mainSize(ch.size), 0) + gapTotal;
    const minMain = isRow ? c.minW : c.minH;
    const ownMain =
      this.mainAxisSize === 'min'
        ? clamp(contentMain, minMain, isFinite(mainMax) ? mainMax : contentMain)
        : isFinite(mainMax)
          ? mainMax
          : contentMain;
    const ownCross =
      this.align === 'stretch' && isFinite(crossMax)
        ? crossMax
        : clamp(maxCross, isRow ? c.minH : c.minW, crossMax);

    // Position along the main axis per justify.
    const freeMain = Math.max(0, ownMain - contentMain);
    let cursor = 0;
    let between = this.gap;
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
        between = this.gap + (n > 1 ? freeMain / (n - 1) : 0);
        break;
      case 'space-around': {
        const around = n > 0 ? freeMain / n : 0;
        cursor = around / 2;
        between = this.gap + around;
        break;
      }
    }

    // Place each child: main via cursor, cross via align.
    for (const ch of this.children) {
      const cs = crossSize(ch.size);
      let crossOffset = 0;
      if (this.align === 'center') crossOffset = (ownCross - cs) / 2;
      else if (this.align === 'end') crossOffset = ownCross - cs;
      // 'start' and 'stretch' -> 0

      if (isRow) {
        ch.offsetX = cursor;
        ch.offsetY = crossOffset;
      } else {
        ch.offsetX = crossOffset;
        ch.offsetY = cursor;
      }
      cursor += mainSize(ch.size) + between;
    }

    this.size = isRow ? { w: ownMain, h: ownCross } : { w: ownCross, h: ownMain };
    return this.size;
  }
}
