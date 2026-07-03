import type { TextStyle } from '@cairn/host';
import { LayoutNode } from './node';
import { type Constraints, type Size, type LayoutContext, clamp } from './types';

export interface TextNodeProps {
  text: string;
  style: TextStyle;
  lineHeight?: number;
  maxLines?: number;
  ellipsis?: string;
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
  maxLines?: number;
  ellipsis?: string;
  lines: string[] = [];

  constructor(props: TextNodeProps) {
    super();
    this.text = props.text;
    this.style = props.style;
    this.lineHeight = props.lineHeight;
    this.maxLines = props.maxLines;
    this.ellipsis = props.ellipsis;
  }

  layout(c: Constraints, ctx: LayoutContext): Size {
    const lineH = this.lineHeight ?? fontSize(this.style.font);
    const paragraphs = this.text.split('\n');
    const lines: string[] = [];

    for (const para of paragraphs) {
      if (!isFinite(c.maxW)) {
        lines.push(para);
        continue;
      }
      const words = para.split(' ');
      let line = '';
      for (const word of words) {
        const candidate = line === '' ? word : line + ' ' + word;
        if (line !== '' && ctx.measureText(candidate, this.style).width > c.maxW) {
          lines.push(line);
          line = word;
        } else {
          line = candidate;
        }
      }
      lines.push(line);
    }

    if (this.maxLines != null && lines.length > this.maxLines) {
      const kept = lines.slice(0, this.maxLines);
      if (this.ellipsis && kept.length > 0) {
        const maxW = c.maxW;
        let last = kept[kept.length - 1];
        // Drop trailing characters until `last + ellipsis` fits maxW (or nothing left).
        while (last.length > 0 && isFinite(maxW) && ctx.measureText(last + this.ellipsis, this.style).width > maxW) {
          last = last.slice(0, -1);
        }
        kept[kept.length - 1] = last + this.ellipsis;
      }
      lines.length = 0;
      lines.push(...kept);
    }

    this.lines = lines;
    const widest = lines.reduce((m, l) => Math.max(m, ctx.measureText(l, this.style).width), 0);
    const w = clamp(widest, c.minW, c.maxW);
    const h = clamp(lines.length * lineH, c.minH, c.maxH);
    this.size = { w, h };
    return this.size;
  }
}
