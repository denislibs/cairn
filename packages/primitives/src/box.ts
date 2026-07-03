import { type Renderer, type Radii, type FillStyle, type Gradient, createPath } from '@cairn/host';
import { BoxNode, toEdgeInsets } from '@cairn/layout';
import { type Instance, bind } from '@cairn/runtime';
import { type BaseStyle, type CornerRadius, type BorderSide, type StyleGradient } from '@cairn/style';
import { type StyleInput } from './resolve-input';
import { createInteractive } from './interactive';
import type { EventProps } from './events';
import { applyLayoutChildProps, applyLayoutStyle, type LayoutChildProps } from './layout-child';

export interface BoxProps extends EventProps, LayoutChildProps {
  style?: StyleInput;
  children?: Instance;
  focusable?: boolean;
}

function radiusToRadii(r: CornerRadius | undefined): Radii {
  return r ?? 0;
}

function dashFor(style: BorderSide['style'], width: number): number[] {
  if (style === 'dashed') return [width * 3, width * 2];
  if (style === 'dotted') return [width, width * 2];
  return [];
}

function shrinkRadii(r: CornerRadius | undefined, by: number): Radii {
  if (r == null) return 0;
  if (typeof r === 'number') return Math.max(0, r - by);
  return {
    tl: Math.max(0, r.tl - by),
    tr: Math.max(0, r.tr - by),
    br: Math.max(0, r.br - by),
    bl: Math.max(0, r.bl - by),
  };
}

function toHostGradient(g: StyleGradient): Gradient {
  return g as unknown as Gradient; // structurally identical shapes
}

function paintSide(
  r: Renderer,
  side: BorderSide | undefined,
  from: [number, number],
  to: [number, number],
): void {
  if (!side) return;
  r.save();
  r.setLineDash(dashFor(side.style, side.width));
  const p = createPath().moveTo(from[0], from[1]).lineTo(to[0], to[1]).build();
  r.strokePath(p, { color: side.color, width: side.width });
  r.setLineDash([]);
  r.restore();
}

function paintBox(r: Renderer, s: BaseStyle, w: number, h: number): void {
  if (s.backgroundColor || s.backgroundGradient) {
    const fill: FillStyle = s.backgroundGradient
      ? { gradient: toHostGradient(s.backgroundGradient) }
      : { color: s.backgroundColor };
    if (s.boxShadow) {
      r.save();
      r.setShadow(s.boxShadow);
    }
    r.fillRoundRect({ x: 0, y: 0, width: w, height: h }, radiusToRadii(s.borderRadius), fill);
    if (s.boxShadow) {
      r.setShadow(null);
      r.restore();
    }
  }
  if (s.border) {
    const bw = s.border.width;
    r.save();
    r.setLineDash(dashFor(s.border.style, bw));
    r.strokeRoundRect(
      { x: bw / 2, y: bw / 2, width: Math.max(0, w - bw), height: Math.max(0, h - bw) },
      shrinkRadii(s.borderRadius, bw / 2),
      { color: s.border.color, width: bw },
    );
    r.setLineDash([]);
    r.restore();
  }
  paintSide(r, s.borderTop, [0, 0], [w, 0]);
  paintSide(r, s.borderRight, [w, 0], [w, h]);
  paintSide(r, s.borderBottom, [0, h], [w, h]);
  paintSide(r, s.borderLeft, [0, 0], [0, h]);
}

export function Box(props: BoxProps = {}): Instance {
  const child = props.children;
  const { resolved, handlers } = createInteractive(props);
  const layout = new BoxNode({ child: child?.layout });
  let current: BaseStyle = {};

  const instance: Instance = {
    layout,
    children: child ? [child] : [],
    handlers,
    focusable: props.focusable,
    paintSelf(r: Renderer) {
      paintBox(r, current, layout.size.w, layout.size.h);
    },
  };

  // Reactive: re-applies (and schedules a frame) when hovered/pressed change.
  bind(resolved, (s) => {
    current = s;
    layout.width = s.width;
    layout.height = s.height;
    layout.minWidth = s.minWidth;
    layout.maxWidth = s.maxWidth;
    layout.minHeight = s.minHeight;
    layout.maxHeight = s.maxHeight;
    layout.padding = toEdgeInsets(s.padding);
    layout.alignX = s.alignX ?? 'start';
    layout.alignY = s.alignY ?? 'start';
    layout.aspectRatio = s.aspectRatio;
    applyLayoutStyle(layout, s);
    instance.paintOpacity = s.opacity;
    instance.clipChildren =
      s.overflow === 'hidden' || s.overflow === 'clip' ? s.borderRadius ?? 0 : undefined;
  });

  applyLayoutChildProps(instance, props);
  return instance;
}
