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

    // Overlay children fill the stack but do not drive its size (e.g. a ripple
    // over a hug-sized button). When any overlay child is present the stack hugs
    // its normal children, then overlays are laid out tight to that resolved size.
    const overlays = this.children.filter((ch) => ch.overlay);
    const normals = this.children.filter((ch) => !ch.overlay);
    const hasOverlay = overlays.length > 0;

    let maxRight = 0;
    let maxBottom = 0;
    for (const ch of normals) {
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

    // With overlays present, hug the normal children (ignore finite max — hugging
    // is the whole point of an overlay). Otherwise keep the fill-available default.
    const w = Math.max(hasOverlay ? maxRight : isFinite(c.maxW) ? c.maxW : maxRight, c.minW);
    const h = Math.max(hasOverlay ? maxBottom : isFinite(c.maxH) ? c.maxH : maxBottom, c.minH);

    // Pass 2: overlays fill the resolved stack size.
    for (const ch of overlays) {
      ch.layout({ minW: w, maxW: w, minH: h, maxH: h }, ctx);
      ch.offsetX = ch.left ?? 0;
      ch.offsetY = ch.top ?? 0;
    }

    this.size = { w, h };
    return this.size;
  }
}
