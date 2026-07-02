// Fine-grained reactive engine (SolidJS / `reactively`-style).
// Synchronous, glitch-free, lazy memos. No DOM APIs — platform-agnostic.

export type EqualsFn<T> = (prev: T, next: T) => boolean;
export const defaultEquals = <T>(a: T, b: T): boolean => a === b;

// ---- context ----
export interface Context<T> {
  readonly id: symbol;
  readonly defaultValue: T;
}

// ---- node states ----
const CLEAN = 0;
const CHECK = 1;
const STALE = 2;
const DISPOSED = 3;
type State = 0 | 1 | 2 | 3;

// A "source" can be observed. Plain signals are SignalState; memos are Computations
// (which structurally include value/observers/equals, so they are sources too).
export interface SignalState<T> {
  value: T;
  observers: Computation<any>[] | null;
  equals: EqualsFn<T> | false;
}

export interface Owner {
  owned: Computation<any>[] | null;
  cleanups: (() => void)[] | null;
  owner: Owner | null;
  context?: Record<symbol, unknown>;
}

export interface Computation<T> extends Owner, SignalState<T> {
  fn: ((prev: T) => T) | null;
  state: State;
  sources: SignalState<any>[] | null; // dependencies
  isMemo: boolean;
  isEffect: boolean;
}

// ---- globals ----
let currentListener: Computation<any> | null = null; // observer collecting deps
let currentOwner: Owner | null = null; // owner for cleanup
let Effects: Computation<any>[] | null = null; // non-null => inside an update batch
let runawayGuard = 0;
const RUNAWAY_LIMIT = 100000;

export function getOwner(): Owner | null {
  return currentOwner;
}

// ---- signal read/write ----
export function readSource<T>(node: SignalState<T>): T {
  if (currentListener) {
    (currentListener.sources || (currentListener.sources = [])).push(node);
    (node.observers || (node.observers = [])).push(currentListener);
  }
  return node.value;
}

export function writeSignal<T>(node: SignalState<T>, value: T): T {
  if (node.equals === false || !node.equals(node.value, value)) {
    node.value = value;
    const observers = node.observers;
    if (observers && observers.length) {
      runUpdates(() => {
        for (let i = 0; i < observers.length; i++) markDirty(observers[i], STALE);
      });
    }
  }
  return value;
}

// ---- dirty propagation ----
function markDirty(node: Computation<any>, state: State): void {
  if (node.state >= state) return;
  const wasClean = node.state === CLEAN;
  node.state = state;
  if (node.isMemo && node.observers) {
    for (let i = 0; i < node.observers.length; i++) markDirty(node.observers[i], CHECK);
  }
  if (node.isEffect && wasClean) scheduleEffect(node);
}

export function scheduleEffect(node: Computation<any>): void {
  (Effects || (Effects = [])).push(node);
}

// ---- pull/update machinery ----
export function updateIfNecessary(node: Computation<any>): void {
  if (node.state === CLEAN || node.state === DISPOSED) return;
  if (node.state === CHECK) {
    const sources = node.sources;
    if (sources) {
      for (let i = 0; i < sources.length; i++) {
        const source = sources[i] as Computation<any>;
        if (source.isMemo) updateIfNecessary(source);
        if ((node.state as State) === STALE) break;
      }
    }
  }
  if (node.state === STALE) runComputation(node);
  else node.state = CLEAN;
}

function runComputation<T>(node: Computation<T>): void {
  cleanNode(node);
  // Clear state BEFORE running fn. If fn writes one of this node's own
  // dependencies, markDirty must see a CLEAN node so it re-schedules this node
  // (and the runaway guard can trip on a genuine self-perpetuating loop).
  node.state = CLEAN;
  const prevListener = currentListener;
  const prevOwner = currentOwner;
  currentListener = node;
  currentOwner = node;
  let next: T;
  try {
    next = node.fn!(node.value);
  } finally {
    currentListener = prevListener;
    currentOwner = prevOwner;
  }
  if (node.isMemo) {
    if (node.equals === false || !node.equals(node.value, next)) {
      node.value = next;
      if (node.observers) {
        for (let i = 0; i < node.observers.length; i++) node.observers[i].state = STALE;
      }
    }
  } else {
    node.value = next;
  }
}

function cleanNode(node: Computation<any>): void {
  // unsubscribe from current sources
  const sources = node.sources;
  if (sources) {
    for (let i = 0; i < sources.length; i++) {
      const observers = sources[i].observers;
      if (observers) {
        const idx = observers.indexOf(node);
        if (idx !== -1) observers.splice(idx, 1);
      }
    }
    sources.length = 0;
  }
  // dispose owned children
  if (node.owned) {
    for (let i = 0; i < node.owned.length; i++) disposeNode(node.owned[i]);
    node.owned.length = 0;
  }
  // run cleanups
  if (node.cleanups) {
    for (let i = 0; i < node.cleanups.length; i++) node.cleanups[i]();
    node.cleanups.length = 0;
  }
}

function disposeNode(node: Computation<any>): void {
  cleanNode(node);
  node.state = DISPOSED;
  node.fn = null;
  node.observers = null;
}

// ---- batching / scheduling ----
export function runUpdates(fn: () => void): void {
  if (Effects) {
    // already inside an update — just schedule into the live queue
    fn();
    return;
  }
  Effects = [];
  runawayGuard = 0;
  try {
    fn();
    // drain — new effects scheduled during the drain are appended and processed
    for (let i = 0; i < Effects.length; i++) {
      if (++runawayGuard > RUNAWAY_LIMIT) {
        throw new Error('[cairn] Potential infinite update loop detected');
      }
      const e = Effects[i];
      if (e.state !== CLEAN && e.state !== DISPOSED) updateIfNecessary(e);
    }
  } finally {
    Effects = null;
  }
}

export function batch<T>(fn: () => T): T {
  if (Effects) return fn();
  let result!: T;
  runUpdates(() => {
    result = fn();
  });
  return result;
}

export function untrack<T>(fn: () => T): T {
  if (currentListener === null) return fn();
  const prev = currentListener;
  currentListener = null;
  try {
    return fn();
  } finally {
    currentListener = prev;
  }
}

// ---- computation construction ----
export function createComputation<T>(
  fn: (prev: T) => T,
  init: T,
  isMemo: boolean,
  isEffect: boolean,
  equals: EqualsFn<T> | false,
): Computation<T> {
  const node: Computation<T> = {
    fn,
    value: init,
    state: STALE,
    sources: null,
    observers: null,
    owned: null,
    cleanups: null,
    owner: currentOwner,
    context: currentOwner ? currentOwner.context : undefined,
    isMemo,
    isEffect,
    equals,
  };
  if (currentOwner) (currentOwner.owned || (currentOwner.owned = [])).push(node);
  return node;
}

// ---- ownership ----
export function createRoot<T>(fn: (dispose: () => void) => T): T {
  const root: Owner = {
    owned: null,
    cleanups: null,
    owner: currentOwner,
    context: currentOwner ? currentOwner.context : undefined,
  };
  const prevOwner = currentOwner;
  const prevListener = currentListener;
  currentOwner = root;
  currentListener = null; // roots do not track
  try {
    return fn(() => disposeOwner(root));
  } finally {
    currentOwner = prevOwner;
    currentListener = prevListener;
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

// Run `fn` in a child owner scope where useContext(ctx) yields `value`. The scope is
// disposed together with its parent (via the parent's cleanups), so effects created
// inside it do not leak.
export function runWithContext<T, R>(ctx: Context<T>, value: T, fn: () => R): R {
  const parent = currentOwner;
  const scope: Owner = {
    owned: null,
    cleanups: null,
    owner: parent,
    context: { ...(parent ? parent.context : undefined), [ctx.id]: value },
  };
  currentOwner = scope;
  try {
    return fn();
  } finally {
    currentOwner = parent;
    if (parent) {
      (parent.cleanups || (parent.cleanups = [])).push(() => disposeOwner(scope));
    }
  }
}

// Create a context token carrying a default value.
export function createContext<T>(defaultValue: T): Context<T> {
  return { id: Symbol('cairn-context'), defaultValue };
}

// Read the current owner's context value for `ctx`, or the default.
export function useContext<T>(ctx: Context<T>): T {
  const map = currentOwner ? currentOwner.context : undefined;
  const value = map ? map[ctx.id] : undefined;
  return value !== undefined ? (value as T) : ctx.defaultValue;
}
