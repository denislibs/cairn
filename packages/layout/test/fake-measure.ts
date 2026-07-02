import type { LayoutContext } from '../src/index';

// Deterministic text measurement for tests: width scales with length and font size.
export function fakeMeasure(): LayoutContext {
  return {
    measureText(text, style) {
      const m = style.font.match(/(\d+(?:\.\d+)?)px/);
      const fontSize = m ? parseFloat(m[1]) : 16;
      return { width: text.length * fontSize * 0.6 };
    },
  };
}
