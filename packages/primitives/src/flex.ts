import { FlexNode, toEdgeInsets, type FlexDirection } from '@cairn/layout';
import { type Instance, bind } from '@cairn/runtime';
import { type BaseStyle } from '@cairn/style';
import { type StyleInput } from './resolve-input';
import { createInteractive } from './interactive';
import type { EventProps } from './events';
import { applyLayoutChildProps, type LayoutChildProps } from './layout-child';

export interface FlexProps extends EventProps, LayoutChildProps {
  style?: StyleInput;
  children?: Instance | Instance[];
  focusable?: boolean;
  // 'min' shrink-wraps the main axis to content; default 'max' fills available space.
  mainAxisSize?: 'min' | 'max';
}

function flex(direction: FlexDirection, props: FlexProps): Instance {
  const { resolved, handlers } = createInteractive(props);
  const children =
    props.children == null ? [] : Array.isArray(props.children) ? props.children : [props.children];
  const layout = new FlexNode({
    direction,
    mainAxisSize: props.mainAxisSize,
    children: children.map((c) => c.layout),
  });

  bind(resolved, (s: BaseStyle) => {
    layout.gap = s.gap ?? 0;
    layout.rowGap = s.rowGap;
    layout.columnGap = s.columnGap;
    layout.justify = s.justify ?? 'start';
    layout.align = s.align ?? 'start';
    layout.width = s.width;
    layout.height = s.height;
    layout.margin = toEdgeInsets(s.margin);
  });

  const instance: Instance = {
    layout,
    children,
    handlers,
    focusable: props.focusable,
    paintSelf() {
      // containers have no own visuals
    },
  };
  applyLayoutChildProps(instance, props);
  return instance;
}

export function Row(props: FlexProps = {}): Instance {
  return flex('row', props);
}

export function Column(props: FlexProps = {}): Instance {
  return flex('column', props);
}
