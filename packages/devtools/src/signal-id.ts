// Shared signal identity — used by both the WhyFrameTracker changed-set and the SignalRegistry
// so a signal has ONE id everywhere.
const ids = new WeakMap<object, number>();
let next = 1;

export function signalId(node: object): number {
  let id = ids.get(node);
  if (id === undefined) { id = next++; ids.set(node, id); }
  return id;
}

/** Test-only: reset the counter (WeakMap keyed by identity persists per object). */
export function resetSignalIds(): void { next = 1; }
