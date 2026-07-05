import type { Instance } from '@cairn/runtime';

const idMap = new WeakMap<Instance, number>();
let nextId = 1;

export function idOf(inst: Instance): number {
  let id = idMap.get(inst);
  if (id === undefined) {
    id = nextId++;
    idMap.set(inst, id);
  }
  return id;
}

/** Test-only: resets the counter (idMap is a WeakMap, keyed by identity). */
export function resetIds(): void {
  nextId = 1;
}
