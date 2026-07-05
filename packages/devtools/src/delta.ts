import type { SnapshotNode, SnapshotDelta } from './protocol';

function index(node: SnapshotNode, map: Map<number, SnapshotNode>, parent: Map<number, number>, parentId?: number): void {
  map.set(node.id, node);
  if (parentId !== undefined) parent.set(node.id, parentId);
  for (const c of node.children) index(c, map, parent, node.id);
}

function shallowEqual(a: SnapshotNode, b: SnapshotNode): boolean {
  // Compare everything except children (structure handled separately).
  const { children: _ac, ...ar } = a;
  const { children: _bc, ...br } = b;
  return JSON.stringify(ar) === JSON.stringify(br);
}

export function computeDelta(prev: SnapshotNode, next: SnapshotNode): SnapshotDelta {
  const prevMap = new Map<number, SnapshotNode>();
  const prevParent = new Map<number, number>();
  const nextMap = new Map<number, SnapshotNode>();
  const nextParent = new Map<number, number>();
  index(prev, prevMap, prevParent);
  index(next, nextMap, nextParent);

  const added: SnapshotNode[] = [];
  const addedParents: Record<number, number> = {};
  const removed: number[] = [];
  const changed: { id: number; patch: Partial<Omit<SnapshotNode, 'children'>> }[] = [];

  for (const [id, node] of nextMap) {
    if (!prevMap.has(id)) {
      // Only record the topmost added node of a new subtree (parent already existed or is itself added-root handled by apply).
      const p = nextParent.get(id);
      if (p === undefined || prevMap.has(p)) {
        added.push(stripChildren(node));
        addedParents[id] = p ?? -1;
      }
    } else if (!shallowEqual(prevMap.get(id)!, node)) {
      const { children: _c, ...patch } = node;
      changed.push({ id, patch });
    }
  }
  for (const id of prevMap.keys()) {
    if (!nextMap.has(id)) {
      const p = prevParent.get(id);
      if (p === undefined || !prevMap.has(p) || nextMap.has(p)) removed.push(id);
    }
  }
  return { added, removed, changed, addedParents };
}

// Deep-clone a node but keep its full subtree (added subtrees are sent whole).
function stripChildren(node: SnapshotNode): SnapshotNode {
  return structuredClone(node);
}

export function applyDelta(prev: SnapshotNode, delta: SnapshotDelta): SnapshotNode {
  const root = structuredClone(prev);
  const map = new Map<number, SnapshotNode>();
  const buildIndex = (n: SnapshotNode): void => { map.set(n.id, n); n.children.forEach(buildIndex); };
  buildIndex(root);

  // 1) removals
  const removedSet = new Set(delta.removed);
  const prune = (n: SnapshotNode): void => {
    n.children = n.children.filter((c) => !removedSet.has(c.id));
    n.children.forEach(prune);
  };
  prune(root);
  removedSet.forEach((id) => map.delete(id));

  // 2) changes
  for (const { id, patch } of delta.changed) {
    const target = map.get(id);
    if (target) Object.assign(target, patch);
  }

  // 3) additions (append under their parent; -1 means new root — not expected for a stable root)
  for (const node of delta.added) {
    const parentId = delta.addedParents[node.id];
    const parent = parentId === -1 ? null : map.get(parentId);
    const clone = structuredClone(node);
    const reindex = (nn: SnapshotNode): void => { map.set(nn.id, nn); nn.children.forEach(reindex); };
    reindex(clone);
    if (parent) parent.children.push(clone);
  }

  return root;
}
