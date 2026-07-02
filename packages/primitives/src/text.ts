import type { Renderer } from '@cairn/host';
import { TextNode } from '@cairn/layout';
import { type Instance, bind, type MaybeReactive } from '@cairn/runtime';
import { type BaseStyle } from '@cairn/style';
import { type StyleInput } from './resolve-input';
import { createInteractive } from './interactive';
import type { EventProps } from './events';
import { applyLayoutChildProps, applyLayoutStyle, type LayoutChildProps } from './layout-child';

export interface TextProps extends EventProps, LayoutChildProps {
  children?: MaybeReactive<string | number>;
  value?: MaybeReactive<string | number>;
  style?: StyleInput;
  focusable?: boolean;
}

export function Text(props: TextProps = {}): Instance {
  const { resolved, handlers } = createInteractive(props);
  const layout = new TextNode({ text: '', style: { font: '16px sans-serif' } });
  let current: BaseStyle = {};

  const content = props.value ?? props.children ?? '';

  const instance: Instance = {
    layout,
    children: [],
    handlers,
    focusable: props.focusable,
    paintSelf(r: Renderer) {
      const s = current;
      const w = layout.size.w;
      const h = layout.size.h;
      const align = s.textAlign ?? 'left';
      const x = align === 'center' ? w / 2 : align === 'right' ? w : 0;
      const useLine = s.lineHeight != null;
      const y = useLine ? h / 2 : 0;
      if (s.textShadow) { r.save(); r.setShadow(s.textShadow); }
      r.drawText(layout.text, { x, y }, {
        font: s.font ?? '16px sans-serif',
        color: s.color ?? '#000',
        align,
        baseline: useLine ? 'middle' : 'top',
      });
      if (s.textShadow) { r.setShadow(null); r.restore(); }
    },
  };

  // Reactive style: font drives both layout (measure) and paint; color is paint-only.
  bind(resolved, (s) => {
    current = s;
    layout.style = { ...layout.style, font: s.font ?? '16px sans-serif' };
    applyLayoutStyle(layout, s);
    instance.paintOpacity = s.opacity;
  });

  bind(content, (v) => {
    layout.text = String(v);
  });

  applyLayoutChildProps(instance, props);
  return instance;
}
