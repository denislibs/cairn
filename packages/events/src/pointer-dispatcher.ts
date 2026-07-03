import type { PointerInput, WheelInput } from '@cairn/host';
import type { HitNode } from './event';
import { hitTest } from './hit-test';
import { dispatch, dispatchWheel, dispatchTo } from './dispatch';

// Both paths are ordered [target ... root]. The first node of `a` also present in
// `b` is therefore the deepest node they share.
export function nearestCommonAncestor(a: HitNode[], b: HitNode[]): HitNode | null {
  const inB = new Set(b);
  for (const node of a) {
    if (inB.has(node)) return node;
  }
  return null;
}

export interface PointerDispatcher {
  handlePointer(input: PointerInput): void;
  handleWheel(input: WheelInput): void;
}

export interface PointerDispatcherHooks {
  onPointerDown?(path: HitNode[]): void; // fires on every pointerdown, incl. empty path
  onHoverChange?(path: HitNode[]): void; // fires when the hovered target changes
}

// Absolute top-left of path[0] (the target): each node's offset is relative to the
// next node in the path (its parent), so summing the whole path yields the target's
// surface-space position.
function absOffset(path: HitNode[]): { x: number; y: number } {
  let x = 0;
  let y = 0;
  for (const n of path) {
    x += n.layout.offsetX;
    y += n.layout.offsetY;
  }
  return { x, y };
}

// Translates raw pointer input into hit-tested bubble dispatch, synthesizing a
// `click` on pointerup at the nearest common ancestor of the down and up paths.
export function createPointerDispatcher(
  getRoot: () => HitNode,
  hooks?: PointerDispatcherHooks,
): PointerDispatcher {
  let downPath: HitNode[] | null = null;
  let hoverPath: HitNode[] = [];

  // Diff the previous hover path against the new one and fire non-bubbling
  // enter/leave. A node stays hovered while the pointer is over a descendant
  // (CSS :hover semantics). Empty newPath fires leave for every hovered node.
  const syncHover = (newPath: HitNode[], input: PointerInput): void => {
    const newSet = new Set(newPath);
    const oldSet = new Set(hoverPath);
    const coords = { x: input.x, y: input.y, button: input.button, pointerType: input.pointerType };
    for (const n of hoverPath) {
      if (!newSet.has(n)) dispatchTo(n, { type: 'pointerleave', ...coords });
    }
    for (const n of newPath) {
      if (!oldSet.has(n)) dispatchTo(n, { type: 'pointerenter', ...coords });
    }
    // Fire onHoverChange when the topmost hovered target changes
    if (newPath[0] !== hoverPath[0]) {
      hooks?.onHoverChange?.(newPath);
    }
    hoverPath = newPath;
  };

  return {
    handlePointer(input: PointerInput): void {
      const path = hitTest(getRoot(), input.x, input.y);
      syncHover(path, input);
      if (input.type === 'pointerdown') hooks?.onPointerDown?.(path);
      if (path.length === 0) {
        // Missing the surface on release drops any pending down.
        if (input.type === 'pointerup') downPath = null;
        return;
      }

      const abs = absOffset(path);
      dispatch(path, {
        type: input.type,
        x: input.x,
        y: input.y,
        localX: input.x - abs.x,
        localY: input.y - abs.y,
        button: input.button,
        pointerType: input.pointerType,
      });

      if (input.type === 'pointerdown') {
        downPath = path;
      } else if (input.type === 'pointerup') {
        if (downPath) {
          const nca = nearestCommonAncestor(downPath, path);
          if (nca) {
            const clickPath = path.slice(path.indexOf(nca));
            const cabs = absOffset(clickPath);
            dispatch(clickPath, {
              type: 'click',
              x: input.x,
              y: input.y,
              localX: input.x - cabs.x,
              localY: input.y - cabs.y,
              button: input.button,
              pointerType: input.pointerType,
            });
          }
        }
        downPath = null;
      }
    },

    handleWheel(input: WheelInput): void {
      const path = hitTest(getRoot(), input.x, input.y);
      if (path.length === 0) return;
      dispatchWheel(path, {
        x: input.x,
        y: input.y,
        deltaX: input.deltaX,
        deltaY: input.deltaY,
      });
    },
  };
}
