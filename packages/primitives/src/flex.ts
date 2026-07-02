import { FlexNode, type FlexDirection } from '@cairn/layout';
import { type Instance } from '@cairn/runtime';
import { useTheme } from '@cairn/style';
import { resolveStyleInput, type StyleInput } from './resolve-input';

export interface FlexProps {
  style?: StyleInput;
  children?: Instance | Instance[];
}

function flex(direction: FlexDirection, props: FlexProps): Instance {
  const s = resolveStyleInput(props.style, useTheme());
  const children =
    props.children == null ? [] : Array.isArray(props.children) ? props.children : [props.children];
  const layout = new FlexNode({
    direction,
    gap: s.gap,
    justify: s.justify,
    align: s.align,
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
