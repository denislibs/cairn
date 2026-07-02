import type { Renderer } from '@cairn/host';
import { BoxNode, toEdgeInsets } from '@cairn/layout';
import { type Instance, bind } from '@cairn/runtime';
import { type BaseStyle } from '@cairn/style';
import { type StyleInput } from './resolve-input';
import { createInteractive } from './interactive';
import type { EventProps } from './events';
import { applyLayoutChildProps, type LayoutChildProps } from './layout-child';

export interface BoxProps extends EventProps, LayoutChildProps {
  style?: StyleInput;
  children?: Instance;
  focusable?: boolean;
}

export function Box(props: BoxProps = {}): Instance {
  const child = props.children;
  const { resolved, handlers } = createInteractive(props);
  const layout = new BoxNode({ child: child?.layout });
  let current: BaseStyle = {};

  // Reactive: re-applies (and schedules a frame) when hovered/pressed change.
  bind(resolved, (s) => {
    current = s;
    layout.width = s.width;
    layout.height = s.height;
    layout.padding = toEdgeInsets(s.padding);
  });

  const instance: Instance = {
    layout,
    children: child ? [child] : [],
    handlers,
    focusable: props.focusable,
    paintSelf(r: Renderer) {
      if (current.backgroundColor) {
        r.fillRoundRect(
          { x: 0, y: 0, width: layout.size.w, height: layout.size.h },
          current.borderRadius ?? 0,
          { color: current.backgroundColor },
        );
      }
    },
  };
  applyLayoutChildProps(instance, props);
  return instance;
}
