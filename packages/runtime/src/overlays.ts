import { createSignal, createContext, useContext, type Context } from '@cairn/reactivity';
import type { Instance } from './instance';

export interface OverlayRegistry {
  add(inst: Instance): number;
  remove(id: number): void;
  list(): Instance[];
  appRoot(): Instance | null;
  setAppRoot(inst: Instance): void;
}

export function createOverlayRegistry(): OverlayRegistry {
  const [entries, setEntries] = createSignal<{ id: number; inst: Instance }[]>([]);
  let nextId = 1;
  let root: Instance | null = null;
  return {
    add(inst) {
      const id = nextId++;
      setEntries([...entries(), { id, inst }]);
      return id;
    },
    remove(id) {
      setEntries(entries().filter((e) => e.id !== id));
    },
    list() {
      return entries().map((e) => e.inst);
    },
    appRoot() {
      return root;
    },
    setAppRoot(inst) {
      root = inst;
    },
  };
}

export const overlayContext: Context<OverlayRegistry | null> = createContext<OverlayRegistry | null>(null);

export function useOverlays(): OverlayRegistry {
  const reg = useContext(overlayContext);
  if (!reg) {
    throw new Error(
      '[cairn] useOverlays() called outside a mounted tree (no overlay registry in context).',
    );
  }
  return reg;
}
