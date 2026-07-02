import { LayoutNode } from './node';
import { type Constraints, type Size, type LayoutContext } from './types';

export interface StackNodeProps {
  children?: LayoutNode[];
}

export class StackNode extends LayoutNode {
  constructor(props: StackNodeProps = {}) {
    super();
    this.children = props.children ?? [];
  }

  layout(c: Constraints, ctx: LayoutContext): Size {
    let maxRight = 0;
    let maxBottom = 0;
    for (const ch of this.children) {
      const s = ch.layout({ minW: 0, maxW: c.maxW, minH: 0, maxH: c.maxH }, ctx);
      const l = ch.left ?? 0;
      const t = ch.top ?? 0;
      ch.offsetX = l;
      ch.offsetY = t;
      maxRight = Math.max(maxRight, l + s.w);
      maxBottom = Math.max(maxBottom, t + s.h);
    }
    const w = isFinite(c.maxW) ? c.maxW : maxRight;
    const h = isFinite(c.maxH) ? c.maxH : maxBottom;
    this.size = { w: Math.max(w, c.minW), h: Math.max(h, c.minH) };
    return this.size;
  }
}
