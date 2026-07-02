import type { KeyboardInput } from '@cairn/host';
import type { HitNode } from './event';
import { dispatchKey } from './dispatch';

export interface FocusEntry {
  node: HitNode;
  path: HitNode[]; // [node ... root]
}

// DFS pre-order; each focusable node paired with its bubble path.
export function collectFocusables(root: HitNode): FocusEntry[] {
  const out: FocusEntry[] = [];
  const walk = (node: HitNode, ancestors: HitNode[]): void => {
    const path = [node, ...ancestors];
    if (node.focusable) out.push({ node, path });
    for (const child of node.children) walk(child, path);
  };
  walk(root, []);
  return out;
}

export interface FocusManager {
  focused(): HitNode | null;
  blur(): void;
  focusFromPointer(path: HitNode[]): void;
  handleKey(input: KeyboardInput): void;
}

// Owns the currently focused node. focus/blur are non-bubbling; key events bubble
// from the focused node to the root; Tab moves focus in tree order.
export function createFocusManager(getRoot: () => HitNode): FocusManager {
  let focusedPath: HitNode[] | null = null;

  const current = (): HitNode | null => (focusedPath ? focusedPath[0] : null);

  const focus = (path: HitNode[]): void => {
    const next = path.length > 0 ? path[0] : null;
    const prev = current();
    if (next === prev) return;
    if (prev) prev.handlers?.onBlur?.({ target: prev });
    focusedPath = next ? path : null;
    if (next) next.handlers?.onFocus?.({ target: next });
  };

  const blur = (): void => {
    const prev = current();
    if (prev) prev.handlers?.onBlur?.({ target: prev });
    focusedPath = null;
  };

  return {
    focused: current,
    blur,
    focusFromPointer(path: HitNode[]): void {
      const idx = path.findIndex((n) => n.focusable);
      if (idx === -1) {
        blur();
        return;
      }
      focus(path.slice(idx));
    },
    handleKey(input: KeyboardInput): void {
      if (input.type === 'keydown' && input.key === 'Tab') {
        input.preventDefault();
        const list = collectFocusables(getRoot());
        if (list.length === 0) return;
        const node = current();
        const index = node ? list.findIndex((f) => f.node === node) : -1;
        let nextIndex: number;
        if (index === -1) {
          nextIndex = input.shift ? list.length - 1 : 0;
        } else {
          nextIndex = (index + (input.shift ? -1 : 1) + list.length) % list.length;
        }
        focus(list[nextIndex].path);
        return;
      }
      if (focusedPath) {
        dispatchKey(focusedPath, {
          type: input.type,
          key: input.key,
          code: input.code,
          shift: input.shift,
          ctrl: input.ctrl,
          alt: input.alt,
          meta: input.meta,
          preventDefault: input.preventDefault,
        });
      }
    },
  };
}
