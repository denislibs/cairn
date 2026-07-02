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
    layout.alignX = s.alignX ?? 'start';
    layout.alignY = s.alignY ?? 'start';
  });

  const instance: Instance = {
    layout,
    children: child ? [child] : [],
    handlers,
    focusable: props.focusable,
    paintSelf(r: Renderer) {
      const s = current;
      const w = layout.size.w;
      const h = layout.size.h;
      const numericRadius = typeof s.borderRadius === 'number' ? s.borderRadius : 0;
      if (s.backgroundColor) {
        r.fillRoundRect({ x: 0, y: 0, width: w, height: h }, s.borderRadius ?? 0, { color: s.backgroundColor });
      }
      if (s.border) {
        const bw = s.border.width;
        r.strokeRoundRect(
          { x: bw / 2, y: bw / 2, width: Math.max(0, w - bw), height: Math.max(0, h - bw) },
          Math.max(0, numericRadius - bw / 2),
          { color: s.border.color, width: bw },
        );
      }
    },
  };
  applyLayoutChildProps(instance, props);
  return instance;
}
