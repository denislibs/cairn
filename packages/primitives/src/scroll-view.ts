import { ScrollNode, clamp } from '@cairn/layout';
import { type Instance, bind } from '@cairn/runtime';
import { createSignal, type Accessor } from '@cairn/reactivity';
import { type BaseStyle } from '@cairn/style';
import { type StyleInput } from './resolve-input';
import { createInteractive } from './interactive';
import type { EventProps } from './events';
import { applyLayoutChildProps, applyLayoutStyle, type LayoutChildProps } from './layout-child';

export interface ScrollViewProps extends EventProps, LayoutChildProps {
  style?: StyleInput;
  children?: Instance;
  direction?: 'vertical' | 'horizontal' | 'both';
  scrollbar?: boolean;
  scrollTop?: number | Accessor<number>;
  scrollLeft?: number | Accessor<number>;
  onScroll?: (pos: { x: number; y: number }) => void;
  focusable?: boolean;
}

function readCtl(v: number | Accessor<number> | undefined): number {
  return typeof v === 'function' ? (v as Accessor<number>)() : (v ?? 0);
}

export function ScrollView(props: ScrollViewProps = {}): Instance {
  const { resolved, handlers } = createInteractive(props);
  const controlledY = props.scrollTop !== undefined;
  const controlledX = props.scrollLeft !== undefined;
  const [internalY, setInternalY] = createSignal(0);
  const [internalX, setInternalX] = createSignal(0);
  const readY = (): number => (controlledY ? readCtl(props.scrollTop) : internalY());
  const readX = (): number => (controlledX ? readCtl(props.scrollLeft) : internalX());

  const node = new ScrollNode({ direction: props.direction, child: props.children?.layout });

  const commitY = (y: number): void => {
    const clamped = clamp(y, 0, node.maxScrollY);
    if (!controlledY) setInternalY(clamped);
    node.scrollY = clamped;
    props.onScroll?.({ x: readX(), y: clamped });
  };

  const commitX = (x: number): void => {
    const clamped = clamp(x, 0, node.maxScrollX);
    if (!controlledX) setInternalX(clamped);
    node.scrollX = clamped;
    props.onScroll?.({ x: clamped, y: readY() });
  };

  const scrollsY = (props.direction ?? 'vertical') !== 'horizontal';
  const scrollsX = props.direction === 'horizontal' || props.direction === 'both';

  const instance: Instance = {
    layout: node,
    children: props.children ? [props.children] : [],
    handlers,
    focusable: props.focusable,
    paintSelf() {},
  };

  // Reactive style → viewport size, clip, transform/opacity
  bind(resolved, (s: BaseStyle) => {
    node.width = s.width;
    node.height = s.height;
    instance.clipChildren = s.borderRadius ?? 0;
    applyLayoutStyle(node, s);
    instance.transform = s.transform;
    instance.transformOrigin = s.transformOrigin;
    instance.paintOpacity = s.opacity;
  });

  // Reactive scroll offset → node (so controlled/external change relayouts)
  bind(readY, (y) => { node.scrollY = clamp(y, 0, node.maxScrollY); });
  bind(readX, (x) => { node.scrollX = clamp(x, 0, node.maxScrollX); });

  // Wheel handler: scroll on wheel event
  const prevOnWheel = props.onWheel;
  handlers.onWheel = (e) => {
    if (scrollsY && e.deltaY) commitY(readY() + e.deltaY);
    if (scrollsX && e.deltaX) commitX(readX() + e.deltaX);
    prevOnWheel?.(e);
  };

  // Drag-to-scroll handler
  let dragging = false;
  let lastX = 0;
  let lastY = 0;

  const prevOnPointerDown = props.onPointerDown;
  handlers.onPointerDown = (e) => {
    dragging = true;
    lastX = e.localX ?? 0;
    lastY = e.localY ?? 0;
    prevOnPointerDown?.(e);
  };

  const prevOnPointerMove = props.onPointerMove;
  handlers.onPointerMove = (e) => {
    if (dragging) {
      const nx = e.localX ?? 0;
      const ny = e.localY ?? 0;
      if (scrollsY) commitY(readY() - (ny - lastY));
      if (scrollsX) commitX(readX() - (nx - lastX));
      lastX = nx;
      lastY = ny;
    }
    prevOnPointerMove?.(e);
  };

  const prevOnPointerUp = props.onPointerUp;
  handlers.onPointerUp = (e) => {
    dragging = false;
    prevOnPointerUp?.(e);
  };

  const prevOnPointerLeave = props.onPointerLeave;
  handlers.onPointerLeave = (e) => {
    dragging = false;
    prevOnPointerLeave?.(e);
  };

  applyLayoutChildProps(instance, props);
  return instance;
}
