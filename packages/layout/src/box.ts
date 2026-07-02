import { LayoutNode } from './node';
import { type Constraints, type Size, type LayoutContext, clamp, resolveAxis } from './types';

export interface EdgeInsets {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export interface BoxNodeProps {
  padding?: number | Partial<EdgeInsets>;
  width?: number;
  height?: number;
  minWidth?: number;
  maxWidth?: number;
  minHeight?: number;
  maxHeight?: number;
  child?: LayoutNode;
  alignX?: 'start' | 'center' | 'end';
  alignY?: 'start' | 'center' | 'end';
}

export function toEdgeInsets(p?: number | Partial<EdgeInsets>): EdgeInsets {
  if (p == null) return { top: 0, right: 0, bottom: 0, left: 0 };
  if (typeof p === 'number') return { top: p, right: p, bottom: p, left: p };
  return { top: p.top ?? 0, right: p.right ?? 0, bottom: p.bottom ?? 0, left: p.left ?? 0 };
}

export class BoxNode extends LayoutNode {
  padding: EdgeInsets;
  width?: number;
  height?: number;
  minWidth?: number;
  maxWidth?: number;
  minHeight?: number;
  maxHeight?: number;
  alignX: 'start' | 'center' | 'end';
  alignY: 'start' | 'center' | 'end';

  constructor(props: BoxNodeProps = {}) {
    super();
    this.padding = toEdgeInsets(props.padding);
    this.width = props.width;
    this.height = props.height;
    this.minWidth = props.minWidth;
    this.maxWidth = props.maxWidth;
    this.minHeight = props.minHeight;
    this.maxHeight = props.maxHeight;
    this.alignX = props.alignX ?? 'start';
    this.alignY = props.alignY ?? 'start';
    if (props.child) this.children = [props.child];
  }

  layout(c: Constraints, ctx: LayoutContext): Size {
    const [selfMinW, selfMaxW] = resolveAxis(c.minW, c.maxW, this.width, this.minWidth, this.maxWidth);
    const [selfMinH, selfMaxH] = resolveAxis(c.minH, c.maxH, this.height, this.minHeight, this.maxHeight);
    const p = this.padding;
    const child = this.children[0];

    let w: number;
    let h: number;
    if (child) {
      const childMaxW = Math.max(0, selfMaxW - p.left - p.right);
      const childMaxH = Math.max(0, selfMaxH - p.top - p.bottom);
      const cs = child.layout({ minW: 0, maxW: childMaxW, minH: 0, maxH: childMaxH }, ctx);
      w = clamp(cs.w + p.left + p.right, selfMinW, selfMaxW);
      h = clamp(cs.h + p.top + p.bottom, selfMinH, selfMaxH);
      const extraX = Math.max(0, w - p.left - p.right - cs.w);
      const extraY = Math.max(0, h - p.top - p.bottom - cs.h);
      child.offsetX = p.left + (this.alignX === 'center' ? extraX / 2 : this.alignX === 'end' ? extraX : 0);
      child.offsetY = p.top + (this.alignY === 'center' ? extraY / 2 : this.alignY === 'end' ? extraY : 0);
    } else {
      w = selfMinW;
      h = selfMinH;
    }
    this.size = { w, h };
    return this.size;
  }
}
