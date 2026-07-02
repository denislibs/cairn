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
}

function toInsets(p?: number | Partial<EdgeInsets>): EdgeInsets {
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

  constructor(props: BoxNodeProps = {}) {
    super();
    this.padding = toInsets(props.padding);
    this.width = props.width;
    this.height = props.height;
    this.minWidth = props.minWidth;
    this.maxWidth = props.maxWidth;
    this.minHeight = props.minHeight;
    this.maxHeight = props.maxHeight;
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
      child.offsetX = p.left;
      child.offsetY = p.top;
      w = clamp(cs.w + p.left + p.right, selfMinW, selfMaxW);
      h = clamp(cs.h + p.top + p.bottom, selfMinH, selfMaxH);
    } else {
      w = selfMinW;
      h = selfMinH;
    }
    this.size = { w, h };
    return this.size;
  }
}
