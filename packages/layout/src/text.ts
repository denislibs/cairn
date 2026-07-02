import type { TextStyle } from '@cairn/host';
import { LayoutNode } from './node';
import { type Constraints, type Size, type LayoutContext, clamp } from './types';

export interface TextNodeProps {
  text: string;
  style: TextStyle;
  lineHeight?: number;
}

// Extract the pixel font size from a CSS font shorthand, defaulting to 16.
function fontSize(font: string): number {
  const m = font.match(/(\d+(?:\.\d+)?)px/);
  return m ? parseFloat(m[1]) : 16;
}

export class TextNode extends LayoutNode {
  text: string;
  style: TextStyle;
  lineHeight?: number;

  constructor(props: TextNodeProps) {
    super();
    this.text = props.text;
    this.style = props.style;
    this.lineHeight = props.lineHeight;
  }

  layout(c: Constraints, ctx: LayoutContext): Size {
    const measured = ctx.measureText(this.text, this.style);
    const w = clamp(Math.min(measured.width, c.maxW), c.minW, c.maxW);
    const h = clamp(this.lineHeight ?? fontSize(this.style.font), c.minH, c.maxH);
    this.size = { w, h };
    return this.size;
  }
}
