import type { SnapshotNode } from './protocol';

export function findNode(root: SnapshotNode, id: number): SnapshotNode | null {
  if (root.id === id) return root;
  for (const child of root.children) {
    const found = findNode(child, id);
    if (found) return found;
  }
  return null;
}
