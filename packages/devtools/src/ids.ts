import type { Instance } from '@cairn/runtime';

const idMap = new WeakMap<Instance, number>();
const reverse = new Map<number, WeakRef<Instance>>();
let nextId = 1;

export function idOf(inst: Instance): number {
  let id = idMap.get(inst);
  if (id === undefined) {
    id = nextId++;
    idMap.set(inst, id);
    reverse.set(id, new WeakRef(inst));
  }
  return id;
}

export function instanceById(id: number): Instance | undefined {
  return reverse.get(id)?.deref();
}

/** Test-only: resets the reverse map and counter (idMap is a WeakMap, keyed by identity). */
export function resetIds(): void {
  reverse.clear();
  nextId = 1;
}
