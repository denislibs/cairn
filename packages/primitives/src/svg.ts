import type { Renderer, FillStyle, StrokeStyle } from '@cairn/host';
import { BoxNode } from '@cairn/layout';
import type { Instance } from '@cairn/runtime';
import type { StyleGradient } from '@cairn/style';
import { parseSvgPath } from './svg-path';
import { applyLayoutChildProps, type LayoutChildProps } from './layout-child';

export interface PathProps extends LayoutChildProps {
  d: string;
  fill?: string | StyleGradient;
  stroke?: string | StyleGradient;
  strokeWidth?: number;
  width: number;
  height: number;
  viewBox?: [number, number, number, number];
}

export function Path(props: PathProps): Instance {
  const path = parseSvgPath(props.d);
  const layout = new BoxNode({ width: props.width, height: props.height });
  const vb = props.viewBox ?? [0, 0, props.width, props.height];

  const instance: Instance = {
    layout,
    children: [],
    paintSelf(r: Renderer) {
      const sx = props.width / (vb[2] || props.width);
      const sy = props.height / (vb[3] || props.height);
      r.save();
      r.scale(sx, sy);
      r.translate(-vb[0], -vb[1]);
      if (props.fill) r.fillPath(path, toFill(props.fill));
      if (props.stroke) r.strokePath(path, toStroke(props.stroke, props.strokeWidth));
      r.restore();
    },
  };

  applyLayoutChildProps(instance, props);
  return instance;
}

export const Svg = Path;

function toFill(v: string | StyleGradient): FillStyle {
  return typeof v === 'string' ? { color: v } : { gradient: v as any };
}

function toStroke(v: string | StyleGradient, width?: number): StrokeStyle {
  return { ...(typeof v === 'string' ? { color: v } : { gradient: v as any }), width: width ?? 1 };
}
