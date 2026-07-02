import { FlexNode, type FlexDirection, type Justify, type Align } from '@cairn/layout';
import type { Instance } from '@cairn/runtime';

export interface FlexStyle {
  gap?: number;
  justify?: Justify;
  align?: Align;
}

export interface FlexProps {
  style?: FlexStyle;
  children?: Instance | Instance[];
}

function flex(direction: FlexDirection, props: FlexProps): Instance {
  const style = props.style ?? {};
  const children =
    props.children == null ? [] : Array.isArray(props.children) ? props.children : [props.children];
  const layout = new FlexNode({
    direction,
    gap: style.gap,
    justify: style.justify,
    align: style.align,
    children: children.map((c) => c.layout),
  });
  return {
    layout,
    children,
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
