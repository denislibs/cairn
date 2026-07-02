import type { HitNode } from './event';

// Depth-first hit-test. Accumulates absolute offset from the root; descends only
// when the point is inside the node, checking children in reverse (later-painted
// on top). Returns the bubble path [target ... root], or [] if the root is missed.
// v1 limitation: descent is gated by the parent's box, so children overflowing
// their parent are not hit.
export function hitTest(root: HitNode, x: number, y: number): HitNode[] {
  return hitAt(root, x, y, 0, 0) ?? [];
}

function hitAt(node: HitNode, x: number, y: number, ax: number, ay: number): HitNode[] | null {
  const nx = ax + node.layout.offsetX;
  const ny = ay + node.layout.offsetY;
  const { w, h } = node.layout.size;
  if (x < nx || x >= nx + w || y < ny || y >= ny + h) return null;

  for (let i = node.children.length - 1; i >= 0; i--) {
    const child = node.children[i];
    const hit = hitAt(child, x, y, nx, ny);
    if (hit) return [...hit, node];
  }
  return [node];
}
