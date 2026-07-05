import type { Renderer } from '@cairn/host';
import { TextNode } from '@cairn/layout';
import { type Instance, bind, type MaybeReactive } from '@cairn/runtime';
import { type BaseStyle, composeFont, applyTextTransform } from '@cairn/style';
import { type StyleInput } from './resolve-input';
import { createInteractive } from './interactive';
import type { EventProps } from './events';
import { applyLayoutChildProps, applyLayoutStyle, type LayoutChildProps } from './layout-child';
import { createStyleTransitions } from './transitions';

export interface TextProps extends EventProps, LayoutChildProps {
  children?: MaybeReactive<string | number>;
  value?: MaybeReactive<string | number>;
  style?: StyleInput;
  focusable?: boolean;
}

// Extract the pixel font size from a CSS font shorthand, defaulting to 16.
function fontSizePx(font: string): number {
  const m = font.match(/(\d+(?:\.\d+)?)px/);
  return m ? parseFloat(m[1]) : 16;
}

export function Text(props: TextProps = {}): Instance {
  const { resolved, handlers } = createInteractive(props);
  const styleSource = createStyleTransitions(resolved);
  const layout = new TextNode({ text: '', style: { font: '16px sans-serif' } });
  let current: BaseStyle = {};
  let rawText = '';

  const content = props.value ?? props.children ?? '';

  const instance: Instance = {
    layout,
    children: [],
    handlers,
    focusable: props.focusable,
    paintSelf(r: Renderer) {
      const s = current;
      const w = layout.size.w;
      const align = s.textAlign ?? 'left';
      const x = align === 'center' ? w / 2 : align === 'right' ? w : 0;
      const useLine = s.lineHeight != null;
      const lineH = useLine ? (s.lineHeight as number) : fontSizePx(composeFont(s));
      const baseline = useLine ? 'middle' : 'top';

      if (s.textShadow) { r.save(); r.setShadow(s.textShadow); }

      const lines: string[] = (layout as any).lines?.length
        ? (layout as any).lines
        : [layout.text];

      const font = composeFont(s);
      lines.forEach((line: string, i: number) => {
        const y = useLine ? i * lineH + lineH / 2 : i * lineH;
        r.drawText(line, { x, y }, {
          font,
          color: s.color ?? '#000',
          align,
          baseline,
          letterSpacing: s.letterSpacing,
        });
      });

      if (s.textShadow) { r.setShadow(null); r.restore(); }

      if (s.textDecoration && s.textDecoration !== 'none') {
        const lineWidths: number[] = (layout as any).lineWidths ?? [];
        const fontSize = fontSizePx(font);
        const thickness = Math.max(1, fontSize / 16);
        lines.forEach((_line: string, i: number) => {
          const lw = lineWidths[i] ?? w;
          const xStart = align === 'center' ? w / 2 - lw / 2 : align === 'right' ? w - lw : 0;
          const lineTop = i * lineH;
          const decorY = s.textDecoration === 'underline'
            ? (useLine ? lineTop + lineH / 2 + fontSize / 2 : lineTop + fontSize)
            : (useLine ? lineTop + lineH / 2 : lineTop + lineH / 2);
          r.fillRect(
            { x: xStart, y: decorY, width: lw, height: thickness },
            { color: s.color ?? '#000' },
          );
        });
      }
    },
  };

  // Reactive style: font drives both layout (measure) and paint; color is paint-only.
  bind(styleSource, (s) => {
    current = s;
    instance.debugStyle = s;
    layout.style = { ...layout.style, font: composeFont(s), letterSpacing: s.letterSpacing };
    layout.text = applyTextTransform(rawText, s.textTransform);
    layout.maxLines = s.maxLines;
    layout.ellipsis = s.ellipsis;
    applyLayoutStyle(layout, s);
    instance.paintOpacity = s.opacity;
    instance.cursor = s.cursor;
    instance.pointerEvents = s.pointerEvents;
    instance.userSelect = s.userSelect;
  });

  bind(content, (v) => {
    rawText = String(v);
    layout.text = applyTextTransform(rawText, current.textTransform);
  });

  applyLayoutChildProps(instance, props);
  return instance;
}
