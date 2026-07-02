import type { Renderer } from '@cairn/host';
import { TextNode } from '@cairn/layout';
import { type Instance, bind, type MaybeReactive } from '@cairn/runtime';
import { useTheme } from '@cairn/style';
import { resolveStyleInput, type StyleInput } from './resolve-input';

export interface TextProps {
  children?: MaybeReactive<string | number>;
  value?: MaybeReactive<string | number>;
  style?: StyleInput;
}

export function Text(props: TextProps = {}): Instance {
  const s = resolveStyleInput(props.style, useTheme());
  const font = s.font ?? '16px sans-serif';
  const color = s.color ?? '#000';
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
