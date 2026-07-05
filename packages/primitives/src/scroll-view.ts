import { ScrollNode, StackNode, BoxNode, clamp } from '@cairn/layout';
import { type Instance, bind, hostContext } from '@cairn/runtime';
import { createSignal, useContext, type Accessor } from '@cairn/reactivity';
import { type BaseStyle } from '@cairn/style';
import { type StyleInput } from './resolve-input';
import { createInteractive } from './interactive';
import type { EventProps } from './events';
import { applyLayoutChildProps, applyLayoutStyle, type LayoutChildProps } from './layout-child';
import { createStyleTransitions } from './transitions';

export interface ScrollViewProps extends EventProps, LayoutChildProps {
  style?: StyleInput;
  children?: Instance;
  direction?: 'vertical' | 'horizontal' | 'both';
  scrollbar?: boolean;
  scrollTop?: number | Accessor<number>;
  scrollLeft?: number | Accessor<number>;
  onScroll?: (pos: { x: number; y: number }) => void;
  focusable?: boolean;
  momentum?: boolean;
}

function readCtl(v: number | Accessor<number> | undefined): number {
  return typeof v === 'function' ? (v as Accessor<number>)() : (v ?? 0);
}

/**
 * Computes scrollbar thumb geometry for a single axis.
 * @param viewport  visible size (px)
 * @param content   total content size (px)
 * @param scroll    current scroll offset (px)
 * @param minSize   minimum thumb size in px (default 24)
 */
export function scrollThumb(
  viewport: number,
  content: number,
  scroll: number,
  minSize = 24,
): { size: number; offset: number; visible: boolean } {
  if (content <= viewport || viewport <= 0) return { size: 0, offset: 0, visible: false };
  const size = Math.max(minSize, Math.min(viewport, (viewport * viewport) / content));
  const maxScroll = content - viewport;
  const track = viewport - size;
  const offset = maxScroll <= 0 ? 0 : (Math.max(0, Math.min(scroll, maxScroll)) / maxScroll) * track;
  return { size, offset, visible: true };
}

export function ScrollView(props: ScrollViewProps = {}): Instance {
  const { resolved, handlers } = createInteractive(props);
  const styleSource = createStyleTransitions(resolved);
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

  const host = useContext(hostContext);
  const momentumOn = props.momentum !== false && host !== null;
  let velX = 0, velY = 0;
  let momentumHandle = 0;
  let momentumCancel: (() => void) | null = null;
  const stopMomentum = (): void => { momentumCancel?.(); momentumCancel = null; };
  const FRICTION = 0.94, MIN_V = 0.4, START = 1;
  const startMomentum = (): void => {
    if (!host) return;
    stopMomentum();
    let cancelled = false;
    const step = (): void => {
      if (cancelled) return;
      velY *= FRICTION; velX *= FRICTION;
      let alive = false;
      if (scrollsY && Math.abs(velY) > MIN_V) { const b = readY(); commitY(b + velY); if (readY() !== b) alive = true; else velY = 0; }
      if (scrollsX && Math.abs(velX) > MIN_V) { const b = readX(); commitX(b + velX); if (readX() !== b) alive = true; else velX = 0; }
      if (alive) { momentumHandle = host.scheduler.requestFrame(step); } else { momentumCancel = null; }
    };
    momentumHandle = host.scheduler.requestFrame(step);
    momentumCancel = () => { cancelled = true; host.scheduler.cancelFrame(momentumHandle); };
  };

  // Build the viewport instance (the scroll container itself, without input handlers)
  const viewportInst: Instance = {
    layout: node,
    children: props.children ? [props.children] : [],
    paintSelf() {},
  };

  // Reactive style → viewport size, clip, transform/opacity
  bind(styleSource, (s: BaseStyle) => {
    node.width = s.width;
    node.height = s.height;
    viewportInst.clipChildren = s.borderRadius ?? 0;
    applyLayoutStyle(node, s);
    viewportInst.transform = s.transform;
    viewportInst.transformOrigin = s.transformOrigin;
    viewportInst.paintOpacity = s.opacity;
    viewportInst.debugStyle = s;
  });

  // Reactive scroll offset → node (so controlled/external change relayouts)
  bind(readY, (y) => { node.scrollY = clamp(y, 0, node.maxScrollY); });
  bind(readX, (x) => { node.scrollX = clamp(x, 0, node.maxScrollX); });

  // Wheel handler: scroll on wheel event
  const prevOnWheel = props.onWheel;
  handlers.onWheel = (e) => {
    stopMomentum();
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
    stopMomentum(); velX = 0; velY = 0;
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
      const dScrollY = -(ny - lastY);
      const dScrollX = -(nx - lastX);
      if (scrollsY) commitY(readY() + dScrollY);
      if (scrollsX) commitX(readX() + dScrollX);
      velY = 0.7 * velY + 0.3 * dScrollY;
      velX = 0.7 * velX + 0.3 * dScrollX;
      lastX = nx;
      lastY = ny;
    }
    prevOnPointerMove?.(e);
  };

  const prevOnPointerUp = props.onPointerUp;
  handlers.onPointerUp = (e) => {
    dragging = false;
    if (momentumOn && (Math.abs(velY) > START || Math.abs(velX) > START)) startMomentum();
    prevOnPointerUp?.(e);
  };

  const prevOnPointerLeave = props.onPointerLeave;
  handlers.onPointerLeave = (e) => {
    dragging = false;
    if (momentumOn && (Math.abs(velY) > START || Math.abs(velX) > START)) startMomentum();
    prevOnPointerLeave?.(e);
  };

  // If scrollbar is explicitly false, return the bare viewport with handlers
  if (props.scrollbar === false) {
    const instance: Instance = {
      ...viewportInst,
      handlers,
      focusable: props.focusable,
    };
    applyLayoutChildProps(instance, props);
    return instance;
  }

  // Otherwise (scrollbar:true or default): wrap viewport + scrollbar overlay in a Stack.
  // Children order: [0]=viewport, [1]=scrollbar overlay
  const barNode = new BoxNode({});
  const barInst: Instance = {
    layout: barNode,
    children: [],
    paintSelf(r) {
      const vp = node.viewportH;
      const ct = node.contentH;
      const sc = node.scrollY;
      const vw = node.viewportW;
      const ct2 = node.contentW;
      const sc2 = node.scrollX;

      if (scrollsY) {
        const thumb = scrollThumb(vp, ct, sc);
        if (thumb.visible) {
          r.fillRoundRect(
            { x: vw - 8, y: thumb.offset, width: 6, height: thumb.size },
            3,
            { color: 'rgba(120,120,120,0.5)' },
          );
        }
      }

      if (scrollsX) {
        const thumb = scrollThumb(vw, ct2, sc2);
        if (thumb.visible) {
          r.fillRoundRect(
            { x: thumb.offset, y: vp - 8, width: thumb.size, height: 6 },
            3,
            { color: 'rgba(120,120,120,0.5)' },
          );
        }
      }
    },
  };

  const stackNode = new StackNode({ children: [node, barNode] });
  const stackInst: Instance = {
    layout: stackNode,
    children: [viewportInst, barInst],
    handlers,
    focusable: props.focusable,
    paintSelf() {},
  };

  applyLayoutChildProps(stackInst, props);
  return stackInst;
}
