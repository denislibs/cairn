import type { SnapshotNode, ChangedNode } from './protocol';

function flatten(node: SnapshotNode, map: Map<number, SnapshotNode>): void {
  map.set(node.id, node);
  for (const c of node.children) flatten(c, map);
}

export function diffSnapshots(prev: SnapshotNode | null, next: SnapshotNode): ChangedNode[] {
  const prevMap = new Map<number, SnapshotNode>();
  if (prev) flatten(prev, prevMap);
  const out: ChangedNode[] = [];
  const visited = new Set<number>();
  walk(next, prevMap, out, visited);
  for (const id of prevMap.keys()) {
    if (!visited.has(id)) out.push({ id, fields: ['removed'] });
  }
  return out;
}

function walk(node: SnapshotNode, prevMap: Map<number, SnapshotNode>, out: ChangedNode[], visited: Set<number>): void {
  visited.add(node.id);
  const before = prevMap.get(node.id);
  if (!before) {
    out.push({ id: node.id, fields: ['added'] });
  } else {
    const fields: string[] = [];
    if (!rectEq(before.rect, node.rect)) fields.push('rect');
    if (before.offset.x !== node.offset.x || before.offset.y !== node.offset.y) fields.push('offset');
    if (before.layout.flex !== node.layout.flex) fields.push('flex');
    if (before.layout.zIndex !== node.layout.zIndex) fields.push('zIndex');
    if (fields.length) out.push({ id: node.id, fields });
  }
  for (const c of node.children) walk(c, prevMap, out, visited);
}

function rectEq(a: { x: number; y: number; w: number; h: number }, b: { x: number; y: number; w: number; h: number }): boolean {
  return a.x === b.x && a.y === b.y && a.w === b.w && a.h === b.h;
}
