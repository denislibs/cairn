// Fine-grained reactive engine. No DOM APIs — platform-agnostic.

export type EqualsFn<T> = (prev: T, next: T) => boolean;
export const defaultEquals = <T>(a: T, b: T): boolean => a === b;

export interface SignalState<T> {
  value: T;
  observers: Computation<any>[] | null;
  equals: EqualsFn<T> | false;
}

export interface Owner {
  owned: Computation<any>[] | null;
  cleanups: (() => void)[] | null;
  owner: Owner | null;
}

// Placeholder — fleshed out in Task 4.
export interface Computation<T> extends Owner {
  value: T;
}

// ---- globals ----
let currentOwner: Owner | null = null;

export function getOwner(): Owner | null {
  return currentOwner;
}

export function setOwner(owner: Owner | null): Owner | null {
  const prev = currentOwner;
  currentOwner = owner;
  return prev;
}

// ---- signal read/write (no observers wired yet — Task 4) ----
export function readSource<T>(node: SignalState<T>): T {
  return node.value;
}

export function writeSignal<T>(node: SignalState<T>, value: T): T {
  if (node.equals === false || !node.equals(node.value, value)) {
    node.value = value;
  }
  return value;
}

// ---- ownership ----
export function createRoot<T>(fn: (dispose: () => void) => T): T {
  const root: Owner = { owned: null, cleanups: null, owner: currentOwner };
  const prevOwner = currentOwner;
  currentOwner = root;
  try {
    return fn(() => disposeOwner(root));
  } finally {
    currentOwner = prevOwner;
  }
}

export function onCleanup(fn: () => void): () => void {
  if (currentOwner) {
    (currentOwner.cleanups || (currentOwner.cleanups = [])).push(fn);
  }
  return fn;
}

function disposeOwner(owner: Owner): void {
  if (owner.owned) {
    for (let i = 0; i < owner.owned.length; i++) disposeNode(owner.owned[i]);
    owner.owned = null;
  }
  if (owner.cleanups) {
    for (let i = 0; i < owner.cleanups.length; i++) owner.cleanups[i]();
    owner.cleanups = null;
  }
}

// Full implementation arrives in Task 4; here it only needs to recurse cleanups.
function disposeNode(node: Computation<any>): void {
  disposeOwner(node);
}
