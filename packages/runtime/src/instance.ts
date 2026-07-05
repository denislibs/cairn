import type { Renderer, Radii } from '@cairn/host';
import type { LayoutNode } from '@cairn/layout';
import type { EventHandlers } from '@cairn/events';
import type { SemanticsNode } from './semantics';

export interface TransformSpec {
  translateX?: number; translateY?: number;
  scale?: number; scaleX?: number; scaleY?: number;
  rotate?: number; skewX?: number; skewY?: number;
}

export interface Instance {
  layout: LayoutNode;
  paintSelf(r: Renderer): void;
  children: Instance[];
  handlers?: EventHandlers;
  focusable?: boolean;
  cursor?: string;
  pointerEvents?: 'auto' | 'none';
  userSelect?: 'auto' | 'none' | 'text';
  paintOpacity?: number;
  semantics?: SemanticsNode;
  clipChildren?: Radii | null;
  transform?: TransformSpec | null;
  transformOrigin?: { x: number; y: number } | null;
  /** Dev-only human-readable name for devtools; ignored in production. */
  debugName?: string;
}

// Walk the instance tree, translating into each node's local coordinate space.
export function paint(inst: Instance, r: Renderer, parentAlpha = 1): void {
  r.save();
  r.translate(inst.layout.offsetX, inst.layout.offsetY);
  const o = inst.paintOpacity;
  const alpha = o !== undefined && o < 1 ? parentAlpha * o : parentAlpha;
  if (alpha !== parentAlpha) r.setGlobalAlpha(alpha);
  const t = inst.transform;
  if (t) {
    const ox = inst.transformOrigin?.x ?? inst.layout.size.w / 2;
    const oy = inst.transformOrigin?.y ?? inst.layout.size.h / 2;
    r.translate(ox, oy);
    if (t.translateX || t.translateY) r.translate(t.translateX ?? 0, t.translateY ?? 0);
    if (t.rotate) r.rotate((t.rotate * Math.PI) / 180);
    const sx = t.scaleX ?? t.scale ?? 1;
    const sy = t.scaleY ?? t.scale ?? 1;
    if (sx !== 1 || sy !== 1) r.scale(sx, sy);
    if (t.skewX || t.skewY) r.transform(1, Math.tan(((t.skewY ?? 0) * Math.PI) / 180), Math.tan(((t.skewX ?? 0) * Math.PI) / 180), 1, 0, 0);
    r.translate(-ox, -oy);
  }
  inst.paintSelf(r);
  if (inst.clipChildren !== undefined && inst.clipChildren !== null) {
    r.clipRoundRect({ x: 0, y: 0, width: inst.layout.size.w, height: inst.layout.size.h }, inst.clipChildren);
  }
  const ordered = orderByZ(inst.children);
  for (const child of ordered) paint(child, r, alpha);
  r.restore();
}

function orderByZ(children: Instance[]): Instance[] {
  if (!children.some((c) => c.layout.zIndex)) return children; // fast path: all zero
  return children
    .map((c, i) => ({ c, i }))
    .sort((a, b) => a.c.layout.zIndex - b.c.layout.zIndex || a.i - b.i)
    .map((x) => x.c);
}
