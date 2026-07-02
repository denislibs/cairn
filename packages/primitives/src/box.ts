import type { Renderer } from '@cairn/host';
import { BoxNode } from '@cairn/layout';
import { type Instance } from '@cairn/runtime';
import { useTheme } from '@cairn/style';
import { resolveStyleInput, type StyleInput } from './resolve-input';
import { collectHandlers, type EventProps } from './events';

export interface BoxProps extends EventProps {
  style?: StyleInput;
  children?: Instance;
}

export function Box(props: BoxProps = {}): Instance {
  const s = resolveStyleInput(props.style, useTheme());
  const child = props.children;
  const layout = new BoxNode({
    width: s.width,
    height: s.height,
    padding: s.padding,
    child: child?.layout,
  });
  return {
    layout,
    children: child ? [child] : [],
    handlers: collectHandlers(props),
    paintSelf(r: Renderer) {
      if (s.backgroundColor) {
        r.fillRoundRect(
          { x: 0, y: 0, width: layout.size.w, height: layout.size.h },
          s.borderRadius ?? 0,
          { color: s.backgroundColor },
        );
      }
    },
  };
}
