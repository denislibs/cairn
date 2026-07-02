import type { Renderer } from '@cairn/host';
import { TextNode } from '@cairn/layout';
import { type Instance, bind, type MaybeReactive } from '@cairn/runtime';

export interface TextStyle {
  font?: string;
  color?: string;
}

export interface TextProps {
  children?: MaybeReactive<string | number>;
  value?: MaybeReactive<string | number>;
  style?: TextStyle;
}

export function Text(props: TextProps = {}): Instance {
  const style = props.style ?? {};
  const font = style.font ?? '16px sans-serif';
  const color = style.color ?? '#000';
  const layout = new TextNode({ text: '', style: { font } });
  const content = props.value ?? props.children ?? '';
  bind(content, (v) => {
    layout.text = String(v);
  });
  return {
    layout,
    children: [],
    paintSelf(r: Renderer) {
      r.drawText(layout.text, { x: 0, y: 0 }, { font, color, baseline: 'top' });
    },
  };
}
