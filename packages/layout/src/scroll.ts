import { LayoutNode } from './node';
import { type Constraints, type Size, type LayoutContext, clamp } from './types';
import { resolveLength, type Length } from './length';

export interface ScrollNodeProps {
  width?: Length;
  height?: Length;
  direction?: 'vertical' | 'horizontal' | 'both';
  child?: LayoutNode;
}

export class ScrollNode extends LayoutNode {
  width?: Length;
  height?: Length;
  direction: 'vertical' | 'horizontal' | 'both';
  scrollX = 0;
  scrollY = 0;
  contentW = 0;
  contentH = 0;
  viewportW = 0;
  viewportH = 0;
  maxScrollX = 0;
  maxScrollY = 0;

  constructor(props: ScrollNodeProps = {}) {
    super();
    this.width = props.width;
    this.height = props.height;
    this.direction = props.direction ?? 'vertical';
    if (props.child) this.children = [props.child];
  }

  layout(c: Constraints, ctx: LayoutContext): Size {
    const vp = ctx.viewport ?? { w: 0, h: 0 };
    const rfs = ctx.rootFontSize ?? 16;
    const resolve = (len: Length | undefined, basis: number): number | undefined => {
      const r = resolveLength(len, { basis, viewportW: vp.w, viewportH: vp.h, rootFontSize: rfs });
      return r === 'auto' || r === undefined ? undefined : r;
    };
    const vw = resolve(this.width, c.maxW) ?? (isFinite(c.maxW) ? c.maxW : 0);
    const vh = resolve(this.height, c.maxH) ?? (isFinite(c.maxH) ? c.maxH : 0);
    this.viewportW = vw;
    this.viewportH = vh;

    const scrollsX = this.direction === 'horizontal' || this.direction === 'both';
    const scrollsY = this.direction === 'vertical' || this.direction === 'both';

    const child = this.children[0];
    if (child) {
      const cs = child.layout({
        minW: 0, maxW: scrollsX ? Infinity : vw,
        minH: 0, maxH: scrollsY ? Infinity : vh,
      }, ctx);
      this.contentW = cs.w;
      this.contentH = cs.h;
      this.maxScrollX = scrollsX ? Math.max(0, cs.w - vw) : 0;
      this.maxScrollY = scrollsY ? Math.max(0, cs.h - vh) : 0;
      child.offsetX = -clamp(this.scrollX, 0, this.maxScrollX);
      child.offsetY = -clamp(this.scrollY, 0, this.maxScrollY);
    } else {
      this.contentW = 0;
      this.contentH = 0;
      this.maxScrollX = 0;
      this.maxScrollY = 0;
    }

    this.size = { w: vw, h: vh };
    return this.size;
  }
}
