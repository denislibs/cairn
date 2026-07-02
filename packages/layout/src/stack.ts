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
    // Bounding box measured from the stack origin (0,0): children placed at
    // negative left/top extend outside it and do not enlarge the unbounded size.
    const cw = isFinite(c.maxW) ? c.maxW : c.minW;
    const chh = isFinite(c.maxH) ? c.maxH : c.minH;
    let maxRight = 0;
    let maxBottom = 0;
    for (const ch of this.children) {
      const bothX = ch.left != null && ch.right != null;
      const bothY = ch.top != null && ch.bottom != null;
      const tightW = bothX ? Math.max(0, cw - ch.left! - ch.right!) : undefined;
      const tightH = bothY ? Math.max(0, chh - ch.top! - ch.bottom!) : undefined;
      const s = ch.layout({
        minW: tightW ?? 0, maxW: tightW ?? c.maxW,
        minH: tightH ?? 0, maxH: tightH ?? c.maxH,
      }, ctx);
      ch.offsetX = ch.left != null ? ch.left : ch.right != null ? cw - ch.right - s.w : 0;
      ch.offsetY = ch.top != null ? ch.top : ch.bottom != null ? chh - ch.bottom - s.h : 0;
      maxRight = Math.max(maxRight, ch.offsetX + s.w);
      maxBottom = Math.max(maxBottom, ch.offsetY + s.h);
    }
    const w = isFinite(c.maxW) ? c.maxW : maxRight;
    const h = isFinite(c.maxH) ? c.maxH : maxBottom;
    this.size = { w: Math.max(w, c.minW), h: Math.max(h, c.minH) };
    return this.size;
  }
}
