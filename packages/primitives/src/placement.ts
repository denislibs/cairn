import type { Instance } from '@cairn/runtime';

export type Side = 'top' | 'bottom' | 'left' | 'right';
export type PlaceAlign = 'start' | 'center' | 'end';
export interface Rect { x: number; y: number; width: number; height: number }

const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);

export function computePlacement(
  anchor: Rect,
  content: { width: number; height: number },
  viewport: { w: number; h: number },
  opts: { side?: Side; align?: PlaceAlign; offset?: number; flip?: boolean } = {},
): { x: number; y: number; side: Side } {
  const offset = opts.offset ?? 8;
  const align = opts.align ?? 'center';
  let side = opts.side ?? 'bottom';
  const flip = opts.flip !== false;

  const fits = (s: Side): boolean => {
    if (s === 'bottom') return anchor.y + anchor.height + offset + content.height <= viewport.h;
    if (s === 'top') return anchor.y - offset - content.height >= 0;
    if (s === 'right') return anchor.x + anchor.width + offset + content.width <= viewport.w;
    return anchor.x - offset - content.width >= 0; // left
  };
  const opposite: Record<Side, Side> = { top: 'bottom', bottom: 'top', left: 'right', right: 'left' };
  if (flip && !fits(side) && fits(opposite[side])) side = opposite[side];

  let x = 0, y = 0;
  const alignAxis = (start: number, size: number, cSize: number): number =>
    align === 'start' ? start : align === 'end' ? start + size - cSize : start + size / 2 - cSize / 2;

  if (side === 'bottom') { y = anchor.y + anchor.height + offset; x = alignAxis(anchor.x, anchor.width, content.width); }
  else if (side === 'top') { y = anchor.y - offset - content.height; x = alignAxis(anchor.x, anchor.width, content.width); }
  else if (side === 'right') { x = anchor.x + anchor.width + offset; y = alignAxis(anchor.y, anchor.height, content.height); }
  else { x = anchor.x - offset - content.width; y = alignAxis(anchor.y, anchor.height, content.height); }

  x = clamp(x, 0, Math.max(0, viewport.w - content.width));
  y = clamp(y, 0, Math.max(0, viewport.h - content.height));
  return { x, y, side };
}

export function getAbsRect(target: Instance, root: Instance): Rect | null {
  const walk = (node: Instance, ax: number, ay: number): Rect | null => {
    const nx = ax + node.layout.offsetX;
    const ny = ay + node.layout.offsetY;
    if (node === target) return { x: nx, y: ny, width: node.layout.size.w, height: node.layout.size.h };
    for (const c of node.children) { const r = walk(c, nx, ny); if (r) return r; }
    return null;
  };
  return walk(root, 0, 0);
}
