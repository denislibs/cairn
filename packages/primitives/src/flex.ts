import { FlexNode, type FlexDirection } from '@cairn/layout';
import { type Instance, bind } from '@cairn/runtime';
import { type BaseStyle } from '@cairn/style';
import { type StyleInput } from './resolve-input';
import { createInteractive } from './interactive';
import type { EventProps } from './events';

export interface FlexProps extends EventProps {
  style?: StyleInput;
  children?: Instance | Instance[];
}

function flex(direction: FlexDirection, props: FlexProps): Instance {
  const { resolved, handlers } = createInteractive(props);
  const children =
    props.children == null ? [] : Array.isArray(props.children) ? props.children : [props.children];
  const layout = new FlexNode({ direction, children: children.map((c) => c.layout) });

  bind(resolved, (s: BaseStyle) => {
    layout.gap = s.gap ?? 0;
    layout.justify = s.justify ?? 'start';
    layout.align = s.align ?? 'start';
  });

  return {
    layout,
    children,
    handlers,
    paintSelf() {
      // containers have no own visuals
    },
  };
}

export function Row(props: FlexProps = {}): Instance {
  return flex('row', props);
}

export function Column(props: FlexProps = {}): Instance {
  return flex('column', props);
}
