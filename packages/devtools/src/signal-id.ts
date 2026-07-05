// Shared signal identity — used by both the WhyFrameTracker changed-set and the SignalRegistry
// so a signal has ONE id everywhere.
let ids = new WeakMap<object, number>();
let next = 1;

export function signalId(node: object): number {
  let id = ids.get(node);
  if (id === undefined) { id = next++; ids.set(node, id); }
  return id;
}

/** Test-only: reset the counter and clear the id map. */
export function resetSignalIds(): void { ids = new WeakMap(); next = 1; }
