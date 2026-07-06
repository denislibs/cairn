import { GridNode, parseTracks } from '@cairn/layout';
import { type Instance, bind, applyStyleOverride, readStyleOverride, runWithDevOwner } from '@cairn/runtime';
import { type BaseStyle } from '@cairn/style';
import { type StyleInput } from './resolve-input';
import { createInteractive } from './interactive';
import type { EventProps } from './events';
import { applyLayoutChildProps, applyLayoutStyle, type LayoutChildProps } from './layout-child';
import { createStyleTransitions } from './transitions';

export interface GridProps extends EventProps, LayoutChildProps {
  style?: StyleInput;
  children?: Instance | Instance[];
  focusable?: boolean;
}

export function Grid(props: GridProps = {}): Instance {
  const { resolved, handlers } = createInteractive(props);
  const styleSource = createStyleTransitions(resolved);
  const children =
    props.children == null ? [] : Array.isArray(props.children) ? props.children : [props.children];
  const layout = new GridNode({ children: children.map((c) => c.layout) });

  const instance: Instance = {
    layout,
    children,
    handlers,
    focusable: props.focusable,
    paintSelf() {
      // containers have no own visuals
    },
  };

  runWithDevOwner(instance, 'style', () => bind(styleSource, (raw: BaseStyle) => {
    const s = applyStyleOverride(raw, readStyleOverride(instance));
    if (s.gridTemplateColumns !== undefined) layout.templateColumns = parseTracks(s.gridTemplateColumns);
    if (s.gridTemplateRows !== undefined) layout.templateRows = parseTracks(s.gridTemplateRows);
    if (s.gridTemplateAreas !== undefined)
      layout.templateAreas = s.gridTemplateAreas.map((row) => row.trim().split(/\s+/));
    layout.rowGap = s.rowGap ?? s.gap ?? 0;
    layout.columnGap = s.columnGap ?? s.gap ?? 0;
    if (s.justifyItems !== undefined) layout.justifyItems = s.justifyItems;
    if (s.alignItems !== undefined) layout.alignItems = s.alignItems;
    applyLayoutStyle(layout, s);
    instance.clipChildren =
      s.overflow === 'hidden' || s.overflow === 'clip' ? (s.borderRadius ?? 0) : undefined;
    instance.transform = s.transform;
    instance.transformOrigin = s.transformOrigin;
    instance.paintOpacity = s.opacity;
    instance.debugStyle = s;
  }));

  applyLayoutChildProps(instance, props);
  return instance;
}
