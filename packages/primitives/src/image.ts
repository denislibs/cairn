import type { Renderer, Rect, ImageHandle } from '@cairn/host';
import { BoxNode } from '@cairn/layout';
import type { Instance } from '@cairn/runtime';
import { useHost, scheduleFrame } from '@cairn/runtime';
import { createSignal, createEffect } from '@cairn/reactivity';
import { applyLayoutChildProps, type LayoutChildProps } from './layout-child';
import { Spinner } from './spinner';

export type ObjectFit = 'fill' | 'contain' | 'cover' | 'none';

export function computeObjectFit(fit: ObjectFit, dest: Rect, natural: { w: number; h: number }): { src: Rect; dest: Rect } {
  const fullSrc = { x: 0, y: 0, width: natural.w, height: natural.h };
  if (fit === 'fill') return { src: fullSrc, dest };
  if (fit === 'contain') {
    const scale = Math.min(dest.width / natural.w, dest.height / natural.h);
    const w = natural.w * scale, h = natural.h * scale;
    return { src: fullSrc, dest: { x: dest.x + (dest.width - w) / 2, y: dest.y + (dest.height - h) / 2, width: w, height: h } };
  }
  if (fit === 'cover') {
    const scale = Math.max(dest.width / natural.w, dest.height / natural.h);
    const sw = dest.width / scale, sh = dest.height / scale;
    return { src: { x: (natural.w - sw) / 2, y: (natural.h - sh) / 2, width: sw, height: sh }, dest };
  }
  // none: natural size centered, cropped to dest
  const sw = Math.min(natural.w, dest.width), sh = Math.min(natural.h, dest.height);
  return {
    src: { x: (natural.w - sw) / 2, y: (natural.h - sh) / 2, width: sw, height: sh },
    dest: { x: dest.x + (dest.width - sw) / 2, y: dest.y + (dest.height - sh) / 2, width: sw, height: sh },
  };
}

export interface ImageProps extends LayoutChildProps {
  src: ImageHandle | string;
  width: number;
  height: number;
  objectFit?: ObjectFit;
}

export function Image(props: ImageProps): Instance {
  const isUrl = typeof props.src === 'string';

  if (!isUrl) {
    // ImageHandle path: keep exactly the current behavior
    const src = props.src as ImageHandle;
    const layout = new BoxNode({ width: props.width, height: props.height });
    const instance: Instance = {
      layout,
      children: [],
      paintSelf(r: Renderer) {
        const { src: srcRect, dest } = computeObjectFit(
          props.objectFit ?? 'fill',
          { x: 0, y: 0, width: layout.size.w, height: layout.size.h },
          { w: src.width, h: src.height },
        );
        r.drawImage(src, dest, srcRect);
      },
    };
    applyLayoutChildProps(instance, props);
    return instance;
  }

  // URL async path
  const layout = new BoxNode({ width: props.width, height: props.height, alignX: 'center', alignY: 'center' });
  const [handle, setHandle] = createSignal<ImageHandle | null>(null);
  const [status, setStatus] = createSignal<'loading' | 'loaded' | 'error'>('loading');

  const instance: Instance = {
    layout,
    children: [],
    paintSelf(r: Renderer) {
      const h = handle();
      if (h) {
        const { src, dest } = computeObjectFit(
          props.objectFit ?? 'fill',
          { x: 0, y: 0, width: layout.size.w, height: layout.size.h },
          { w: h.width, h: h.height },
        );
        r.drawImage(h, dest, src);
      } else if (status() === 'error') {
        r.fillRoundRect({ x: 0, y: 0, width: layout.size.w, height: layout.size.h }, 6, { color: '#2a2a2e' });
      }
      // loading: nothing (Spinner child paints)
    },
  };

  const host = useHost();
  host.loadImage?.(props.src as string)
    .then((h) => { setHandle(h); setStatus('loaded'); scheduleFrame(); })
    .catch(() => { setStatus('error'); scheduleFrame(); });

  createEffect(() => {
    instance.children = status() === 'loading' ? [Spinner({ size: Math.max(16, Math.min(props.width, props.height) / 3) })] : [];
    (instance.layout as any).children = instance.children.map((c) => c.layout);
    scheduleFrame();
  });

  applyLayoutChildProps(instance, props);
  return instance;
}
