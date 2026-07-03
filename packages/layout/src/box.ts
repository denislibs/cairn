import { LayoutNode } from './node';
import { type Constraints, type Size, type LayoutContext, type EdgeInsets, clamp, resolveAxis } from './types';
import { resolveLength, type Length } from './length';

export type { EdgeInsets };

export interface LengthEdgeInsets {
  top: Length;
  right: Length;
  bottom: Length;
  left: Length;
}

export interface BoxNodeProps {
  padding?: Length | Partial<LengthEdgeInsets>;
  width?: Length;
  height?: Length;
  minWidth?: Length;
  maxWidth?: Length;
  minHeight?: Length;
  maxHeight?: Length;
  child?: LayoutNode;
  alignX?: 'start' | 'center' | 'end';
  alignY?: 'start' | 'center' | 'end';
  aspectRatio?: number;
}

export function toEdgeInsets(p?: number | Partial<EdgeInsets>): EdgeInsets {
  if (p == null) return { top: 0, right: 0, bottom: 0, left: 0 };
  if (typeof p === 'number') return { top: p, right: p, bottom: p, left: p };
  return { top: p.top ?? 0, right: p.right ?? 0, bottom: p.bottom ?? 0, left: p.left ?? 0 };
}

function toLengthInsets(p?: Length | Partial<LengthEdgeInsets>): LengthEdgeInsets {
  if (p == null) return { top: 0, right: 0, bottom: 0, left: 0 };
  if (typeof p === 'number' || typeof p === 'string') return { top: p, right: p, bottom: p, left: p };
  return { top: p.top ?? 0, right: p.right ?? 0, bottom: p.bottom ?? 0, left: p.left ?? 0 };
}

export class BoxNode extends LayoutNode {
  padding: Length | Partial<LengthEdgeInsets>;
  width?: Length;
  height?: Length;
  minWidth?: Length;
  maxWidth?: Length;
  minHeight?: Length;
  maxHeight?: Length;
  alignX: 'start' | 'center' | 'end';
  alignY: 'start' | 'center' | 'end';
  aspectRatio?: number;

  constructor(props: BoxNodeProps = {}) {
    super();
    this.padding = props.padding ?? 0;
    this.width = props.width;
    this.height = props.height;
    this.minWidth = props.minWidth;
    this.maxWidth = props.maxWidth;
    this.minHeight = props.minHeight;
    this.maxHeight = props.maxHeight;
    this.alignX = props.alignX ?? 'start';
    this.alignY = props.alignY ?? 'start';
    this.aspectRatio = props.aspectRatio;
    if (props.child) this.children = [props.child];
  }

  layout(c: Constraints, ctx: LayoutContext): Size {
    const vp = ctx.viewport ?? { w: 0, h: 0 };
    const rfs = ctx.rootFontSize ?? 16;
    const resolveAxisLen = (len: Length | undefined, basis: number): number | undefined => {
      const r = resolveLength(len, { basis, viewportW: vp.w, viewportH: vp.h, rootFontSize: rfs });
      return r === 'auto' || r === undefined ? undefined : r;
    };
    const width = resolveAxisLen(this.width, c.maxW);
    const height = resolveAxisLen(this.height, c.maxH);
    const minWidth = resolveAxisLen(this.minWidth, c.maxW);
    const maxWidth = resolveAxisLen(this.maxWidth, c.maxW);
    const minHeight = resolveAxisLen(this.minHeight, c.maxH);
    const maxHeight = resolveAxisLen(this.maxHeight, c.maxH);
    // padding: resolve each inset against c.maxW (CSS inline-size basis)
    const rawPad = toLengthInsets(this.padding);
    const p = {
      top: resolveAxisLen(rawPad.top, c.maxW) ?? 0,
      right: resolveAxisLen(rawPad.right, c.maxW) ?? 0,
      bottom: resolveAxisLen(rawPad.bottom, c.maxW) ?? 0,
      left: resolveAxisLen(rawPad.left, c.maxW) ?? 0,
    };

    const [selfMinW, selfMaxW] = resolveAxis(c.minW, c.maxW, width, minWidth, maxWidth);
    const [selfMinH, selfMaxH] = resolveAxis(c.minH, c.maxH, height, minHeight, maxHeight);
    const child = this.children[0];

    let w: number;
    let h: number;
    if (child) {
      const m = child.margin;
      const childMaxW = Math.max(0, selfMaxW - p.left - p.right - m.left - m.right);
      const childMaxH = Math.max(0, selfMaxH - p.top - p.bottom - m.top - m.bottom);
      const cs = child.layout({ minW: 0, maxW: childMaxW, minH: 0, maxH: childMaxH }, ctx);
      const outerW = cs.w + m.left + m.right;
      const outerH = cs.h + m.top + m.bottom;
      w = clamp(outerW + p.left + p.right, selfMinW, selfMaxW);
      h = clamp(outerH + p.top + p.bottom, selfMinH, selfMaxH);
      const extraX = Math.max(0, w - p.left - p.right - outerW);
      const extraY = Math.max(0, h - p.top - p.bottom - outerH);
      child.offsetX = p.left + m.left + (this.alignX === 'center' ? extraX / 2 : this.alignX === 'end' ? extraX : 0);
      child.offsetY = p.top + m.top + (this.alignY === 'center' ? extraY / 2 : this.alignY === 'end' ? extraY : 0);
    } else {
      w = selfMinW;
      h = selfMinH;
    }
    if (this.aspectRatio && this.aspectRatio > 0) {
      const widthKnown = width != null;
      const heightKnown = height != null;
      if (widthKnown && !heightKnown) h = clamp(w / this.aspectRatio, selfMinH, selfMaxH);
      else if (heightKnown && !widthKnown) w = clamp(h * this.aspectRatio, selfMinW, selfMaxW);
      else if (!widthKnown && !heightKnown) h = clamp(w / this.aspectRatio, selfMinH, selfMaxH);
    }
    this.size = { w, h };
    return this.size;
  }
}
