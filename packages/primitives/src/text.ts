import type { Renderer } from '@cairn/host';
import { TextNode } from '@cairn/layout';
import { type Instance, bind, type MaybeReactive } from '@cairn/runtime';
import { type BaseStyle } from '@cairn/style';
import { type StyleInput } from './resolve-input';
import { createInteractive } from './interactive';
import type { EventProps } from './events';

export interface TextProps extends EventProps {
  children?: MaybeReactive<string | number>;
  value?: MaybeReactive<string | number>;
  style?: StyleInput;
  focusable?: boolean;
}

export function Text(props: TextProps = {}): Instance {
  const { resolved, handlers } = createInteractive(props);
  const layout = new TextNode({ text: '', style: { font: '16px sans-serif' } });
  let current: BaseStyle = {};

  // Reactive style: font drives both layout (measure) and paint; color is paint-only.
  bind(resolved, (s) => {
    current = s;
    layout.style = { ...layout.style, font: s.font ?? '16px sans-serif' };
  });

  const content = props.value ?? props.children ?? '';
  bind(content, (v) => {
    layout.text = String(v);
  });

  return {
    layout,
    children: [],
    handlers,
    focusable: props.focusable,
    paintSelf(r: Renderer) {
      r.drawText(
        layout.text,
        { x: 0, y: 0 },
        { font: current.font ?? '16px sans-serif', color: current.color ?? '#000', baseline: 'top' },
      );
    },
  };
}
