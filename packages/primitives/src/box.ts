import type { Renderer } from '@cairn/host';
import { BoxNode, type EdgeInsets } from '@cairn/layout';
import type { Instance } from '@cairn/runtime';

export interface BoxStyle {
  width?: number;
  height?: number;
  padding?: number | Partial<EdgeInsets>;
  backgroundColor?: string;
  borderRadius?: number;
}

export interface BoxProps {
  style?: BoxStyle;
  children?: Instance;
}

export function Box(props: BoxProps = {}): Instance {
  const style = props.style ?? {};
  const child = props.children;
  const layout = new BoxNode({
    width: style.width,
    height: style.height,
    padding: style.padding,
    child: child?.layout,
  });
  return {
    layout,
    children: child ? [child] : [],
    paintSelf(r: Renderer) {
      if (style.backgroundColor) {
        r.fillRoundRect(
          { x: 0, y: 0, width: layout.size.w, height: layout.size.h },
          style.borderRadius ?? 0,
          { color: style.backgroundColor },
        );
      }
    },
  };
}
